package br.com.khki.infrastructure.security;

import br.com.khki.usecase.account.UserRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.csrf.*;
import org.springframework.web.cors.*;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  UserDetailsService userDetailsService(UserRepository users) {
    return email ->
      users
        .findByEmail(email)
        .map(user -> org.springframework.security.core.userdetails.User.withUsername(user.getEmail()).password(user.getPassword()).roles(user.getRole()).build())
        .orElseThrow(() -> new UsernameNotFoundException("Credenciais inválidas."));
  }

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, SessionPolicy sessionPolicy, @Value("${khki.frontend-origin}") String origin) throws Exception {
    var cors = new CorsConfiguration();
    cors.setAllowedOrigins(List.of(origin));
    cors.setAllowedMethods(List.of("GET", "POST", "PUT", "OPTIONS"));
    cors.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
    cors.setAllowCredentials(true);
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", cors);
    return http
      .addFilterAfter(new SessionExpiryFilter(sessionPolicy), SecurityContextHolderFilter.class)
      .cors(config -> config.configurationSource(source))
      .csrf(config -> config.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
      .authorizeHttpRequests(config ->
        config
          .requestMatchers("/api/admin/**")
          .hasRole("ADMIN")
          .requestMatchers(HttpMethod.GET, "/api/bathrooms/duplicates", "/api/bathrooms/nearby")
          .authenticated()
          .requestMatchers(HttpMethod.GET, "/api/auth/csrf", "/api/bathrooms", "/api/bathrooms/*", "/api/bathrooms/*/reviews", "/api/photos/*", "/api/health")
          .permitAll()
          .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register")
          .permitAll()
          .requestMatchers("/api/**")
          .authenticated()
          .anyRequest()
          .denyAll()
      )
      .exceptionHandling(config ->
        config
          .authenticationEntryPoint((request, response, exception) -> {
            response.setStatus(401);
            response.setContentType("application/problem+json;charset=UTF-8");
            response.getWriter().write("{\"status\":401,\"detail\":\"Entre na sua conta para continuar.\"}");
          })
          .accessDeniedHandler((request, response, exception) -> {
            response.setStatus(403);
            response.setContentType("application/problem+json;charset=UTF-8");
            response.getWriter().write("{\"status\":403,\"detail\":\"Operação não autorizada. Atualize a página e confira seu acesso.\"}");
          })
      )
      .logout(config -> config.logoutUrl("/api/auth/logout").logoutSuccessHandler((request, response, auth) -> response.setStatus(204)))
      .headers(config ->
        config
          .contentTypeOptions(options -> {})
          .frameOptions(options -> options.deny())
          .referrerPolicy(options -> options.policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN))
      )
      .build();
  }
}
