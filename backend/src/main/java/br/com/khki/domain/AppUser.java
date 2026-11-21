package br.com.khki.domain;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "app_users")
public class AppUser {

  @Id
  public UUID id = UUID.randomUUID();

  @Column(nullable = false, length = 80)
  public String name;

  @Column(nullable = false, unique = true, length = 254)
  public String email;

  @Column(nullable = false, length = 100)
  public String password;

  @Column(nullable = false, length = 20)
  public String role = "USER";
}
