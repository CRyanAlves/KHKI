package br.com.khki.config;

import br.com.khki.domain.*;
import br.com.khki.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DevelopmentData implements CommandLineRunner {

  private final AppUserRepository users;
  private final BathroomRepository bathrooms;
  private final PasswordEncoder passwords;
  private final String email;
  private final String password;
  private final boolean demo;

  public DevelopmentData(AppUserRepository users, BathroomRepository bathrooms, PasswordEncoder passwords, @Value("${khki.admin-email}") String email, @Value("${khki.admin-password}") String password, @Value("${khki.demo}") boolean demo) {
    this.users = users;
    this.bathrooms = bathrooms;
    this.passwords = passwords;
    this.email = email;
    this.password = password;
    this.demo = demo;
  }

  @Override
  public void run(String... args) {
    if (!email.isBlank() && !password.isBlank() && users.findByEmail(email.toLowerCase(java.util.Locale.ROOT)).isEmpty()) {
      if (password.length() < 12 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) throw new IllegalStateException("Configure uma senha administrativa de 12 a 72 bytes.");
      var user = new AppUser();
      user.setName("Administrador");
      user.setEmail(email.toLowerCase(java.util.Locale.ROOT));
      user.setPassword(passwords.encode(password));
      user.setRole("ADMIN");
      users.save(user);
    }
    if (!demo || bathrooms.count() > 0) return;
    var author = users.findByEmail("demo@khki.invalid").orElseGet(() -> {
      var user = new AppUser();
      user.setName("Demonstração");
      user.setEmail("demo@khki.invalid");
      user.setPassword(passwords.encode(java.util.UUID.randomUUID().toString()));
      return users.save(user);
    });
    seed(author, "Café do Centro", "Rua Augusta, 1234 — Consolação, São Paulo", "Cafeteria", -23.5535, -46.6558, Access.FREE, true, "Segunda a sábado, das 7h às 21h");
    seed(author, "Shopping Aurora", "Avenida Paulista, 900 — Bela Vista, São Paulo", "Shopping", -23.5668, -46.6501, Access.FREE, true, "Todos os dias, das 10h às 22h");
    seed(author, "Espaço da Praça", "Praça da República, 100 — República, São Paulo", "Centro cultural", -23.5432, -46.6428, Access.CUSTOMERS, null, null);
  }

  private void seed(AppUser author, String name, String address, String category, double latitude, double longitude, Access access, Boolean accessible, String hours) {
    var bathroom = new Bathroom();
    bathroom.setAuthorId(author.getId());
    bathroom.setName(name);
    bathroom.setAddress(address);
    bathroom.setCategory(category);
    bathroom.setLatitude(latitude);
    bathroom.setLongitude(longitude);
    bathroom.setAccess(access);
    bathroom.setAccessible(accessible);
    bathroom.setHours(hours);
    bathroom.setItems(new java.util.TreeSet<>(java.util.Set.of("PAPER", "SOAP", "SINK", "BIN")));
    bathroom.setDemo(true);
    bathroom.setStatus(Status.APPROVED);
    bathrooms.save(bathroom);
  }
}
