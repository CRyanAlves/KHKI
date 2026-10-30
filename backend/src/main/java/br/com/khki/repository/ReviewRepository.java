package br.com.khki.repository;

import br.com.khki.domain.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, UUID> {
  java.util.List<Review> findByBathroomIdAndStatusOrderByCreatedAtDesc(UUID bathroomId, Status status);
  java.util.List<Review> findByStatus(Status status);
  java.util.List<Review> findByAuthorIdOrderByCreatedAtDesc(UUID authorId);
}
