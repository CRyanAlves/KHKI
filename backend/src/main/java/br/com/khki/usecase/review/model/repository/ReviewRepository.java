package br.com.khki.usecase.review.model.repository;

import br.com.khki.shared.domain.Status;
import br.com.khki.usecase.review.model.Review;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, UUID> {
  java.util.List<Review> findByBathroom_IdAndStatusOrderByCreatedAtDesc(UUID bathroomId, Status status);
  java.util.List<Review> findByStatus(Status status);
  java.util.List<Review> findByAuthor_IdOrderByCreatedAtDesc(UUID authorId);

  @org.springframework.data.jpa.repository.Query("select value from Review value where cast(value.imageUrls as string) like :pattern")
  java.util.List<Review> findImageOwners(@org.springframework.data.repository.query.Param("pattern") String pattern);
}
