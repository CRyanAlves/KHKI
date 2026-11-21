package br.com.khki.repository;

import br.com.khki.domain.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
  java.util.Optional<AppUser> findByEmail(String email);
}
