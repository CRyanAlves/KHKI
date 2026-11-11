package br.com.khki.usecase.account;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
  java.util.Optional<User> findByEmail(String email);
}
