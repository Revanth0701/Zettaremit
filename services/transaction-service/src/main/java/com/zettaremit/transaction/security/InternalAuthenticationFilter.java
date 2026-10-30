package com.zettaremit.transaction.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class InternalAuthenticationFilter extends OncePerRequestFilter {
    private final byte[] expected;
    public InternalAuthenticationFilter(@Value("${internal.service.token:}") String secret) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException("Internal service token must be configured securely");
        expected = ("Bearer " + secret).getBytes(StandardCharsets.UTF_8);
    }
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if ("/health".equals(req.getRequestURI()) && "GET".equals(req.getMethod())) {
            chain.doFilter(req,res); return;
        }
        String supplied = req.getHeader("Authorization");
        if (supplied == null || !MessageDigest.isEqual(expected, supplied.getBytes(StandardCharsets.UTF_8))) {
            res.setStatus(401); res.setContentType("application/json");
            res.getWriter().write("{\"detail\":\"Service authentication required\"}"); return;
        }
        chain.doFilter(req,res);
    }
}
