package br.com.khki.usecase.bathroom;

import br.com.khki.shared.domain.Status;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BathroomRepository extends JpaRepository<Bathroom, UUID> {
  java.util.List<Bathroom> findByStatus(Status status);
  java.util.List<Bathroom> findByStatusAndLatitudeBetween(Status status, double south, double north);
  java.util.List<Bathroom> findByAuthorIdOrderByCreatedAtDesc(UUID authorId);
  @org.springframework.data.jpa.repository.Query("select value from Bathroom value where cast(value.imageUrls as string) like :pattern")
  java.util.List<Bathroom> findImageOwners(@org.springframework.data.repository.query.Param("pattern") String pattern);
}
