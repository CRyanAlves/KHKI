package br.com.khki.repository;
import br.com.khki.domain.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface BathroomRepository extends JpaRepository<Bathroom, UUID> { java.util.List<Bathroom> findByStatus(Status status); java.util.List<Bathroom> findByAuthorIdOrderByCreatedAtDesc(UUID authorId); }