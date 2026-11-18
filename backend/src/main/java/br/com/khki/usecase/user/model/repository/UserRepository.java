package br.com.khki.usecase.user.model.repository;

import br.com.khki.usecase.user.model.User;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
  java.util.Optional<User> findByEmail(String email);
}
