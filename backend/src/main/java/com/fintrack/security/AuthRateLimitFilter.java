package com.fintrack.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.common.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Throttles unauthenticated auth attempts per client IP.
 *
 * <p>Without this, {@code /auth/login} accepts unlimited password guesses, and
 * because BCrypt runs at cost 12 each attempt burns ~100ms of CPU — so the
 * endpoint doubles as a cheap denial-of-service vector.
 *
 * <p>State is a bounded in-memory sliding window, which is the right scope for
 * this single-instance, local-first app: it needs no dependency and no shared
 * store. It does <strong>not</strong> survive a restart and is <strong>not</strong>
 * shared across replicas — running more than one instance behind a load balancer
 * would need Redis or bucket4j instead.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_ATTEMPTS = 10;

    /** Stop the map from growing without bound under a distributed attack. */
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> lastSweep = new AtomicReference<>(Instant.EPOCH);
    private final ObjectMapper objectMapper;
    private final boolean enabled;

    public AuthRateLimitFilter(ObjectMapper objectMapper,
                               @Value("${security.rate-limit.enabled:true}") boolean enabled) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled) return true;
        // Only the credential-accepting endpoints. /refresh and /logout are
        // driven by a cookie the client already holds, and throttling them
        // would break legitimate multi-tab use.
        String path = request.getRequestURI();
        return !("POST".equalsIgnoreCase(request.getMethod())
                && (path.equals("/api/v1/auth/login") || path.equals("/api/v1/auth/register")));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String client = clientKey(request);
        Instant now = Instant.now();
        sweepIfDue(now);

        if (!tryConsume(client, now)) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(WINDOW.toSeconds()));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(objectMapper.writeValueAsString(ErrorResponse.of(
                    "TOO_MANY_ATTEMPTS",
                    "Too many attempts. Try again later.")));
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean tryConsume(String client, Instant now) {
        Instant cutoff = now.minus(WINDOW);
        Deque<Instant> window = attempts.computeIfAbsent(client, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                window.pollFirst();
            }
            if (window.size() >= MAX_ATTEMPTS) {
                return false;
            }
            window.addLast(now);
            return true;
        }
    }

    /** Drops windows that have fully expired, at most once per window. */
    private void sweepIfDue(Instant now) {
        Instant last = lastSweep.get();
        if (now.isBefore(last.plus(WINDOW)) && attempts.size() < MAX_TRACKED_CLIENTS) {
            return;
        }
        if (!lastSweep.compareAndSet(last, now)) {
            return;
        }
        Instant cutoff = now.minus(WINDOW);
        attempts.entrySet().removeIf(e -> {
            Deque<Instant> w = e.getValue();
            synchronized (w) {
                return w.isEmpty() || w.peekLast().isBefore(cutoff);
            }
        });
    }

    private String clientKey(HttpServletRequest request) {
        // X-Forwarded-For is only trustworthy behind a proxy that overwrites it.
        // Deployed without one, a client can spoof the header and bypass the
        // limit, so this must be paired with a trusted reverse proxy in prod.
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }
}
