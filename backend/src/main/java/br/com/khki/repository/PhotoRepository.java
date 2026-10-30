package br.com.khki.repository;

import br.com.khki.domain.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {
  java.util.List<Photo> findByBathroomIdAndStatus(UUID bathroomId, Status status);
  java.util.List<Photo> findByBathroomIdAndStatusNotOrderByCreatedAtDesc(UUID bathroomId, Status status);
  java.util.List<Photo> findByStatus(Status status);
  java.util.List<Photo> findByAuthorIdOrderByCreatedAtDesc(UUID authorId);
}
