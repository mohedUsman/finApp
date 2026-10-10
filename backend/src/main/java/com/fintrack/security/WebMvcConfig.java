package com.fintrack.security;

import com.fintrack.household.HouseholdService;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final HouseholdService household;

    public WebMvcConfig(HouseholdService household) {
        this.household = household;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserArgumentResolver());
        resolvers.add(new DataOwnerArgumentResolver(household));
    }
}
