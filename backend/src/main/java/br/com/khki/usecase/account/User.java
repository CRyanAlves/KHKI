package br.com.khki.usecase.account;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "app_users")
public class User {

  @Id
  private UUID id = UUID.randomUUID();

  @Column(nullable = false, length = 80)
  private String name;

  @Column(nullable = false, unique = true, length = 254)
  private String email;

  @Column(nullable = false, length = 100)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private String password;

  @Column(nullable = false, length = 20)
  private String role = "USER";

  public UUID getId() { return id; }
  public void setId(UUID value) { id = value; }

  public String getName() { return name; }
  public void setName(String value) { name = value; }

  public String getEmail() { return email; }
  public void setEmail(String value) { email = value; }

  public String getPassword() { return password; }
  public void setPassword(String value) { password = value; }

  public String getRole() { return role; }
  public void setRole(String value) { role = value; }
}
