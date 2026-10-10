package com.fintrack.security;

import com.fintrack.common.exception.UnauthorizedException;
import com.fintrack.household.HouseholdService;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.Set;
import java.util.UUID;

public class DataOwnerArgumentResolver implements HandlerMethodArgumentResolver {

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final HouseholdService household;

    public DataOwnerArgumentResolver(HouseholdService household) {
        this.household = household;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(DataOwner.class)
                && parameter.getParameterType().equals(UUID.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AuthenticatedUser principal)) {
            throw new UnauthorizedException("Authentication required");
        }
        UUID userId = principal.userId();

        // Enforced here rather than per-controller so a new write endpoint
        // can't silently skip the VIEWER check by forgetting to call it.
        String method = webRequest.getNativeRequest(jakarta.servlet.http.HttpServletRequest.class).getMethod();
        if (MUTATING_METHODS.contains(method)) {
            household.requireWriteAccess(userId);
        }

        return household.dataOwnerFor(userId);
    }
}
