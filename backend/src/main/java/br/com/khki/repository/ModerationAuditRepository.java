package br.com.khki.repository;

import br.com.khki.domain.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModerationAuditRepository extends JpaRepository<ModerationAudit, UUID> {
  java.util.List<ModerationAudit> findAllByOrderByCreatedAtDesc();
  java.util.List<ModerationAudit> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(TargetType type, UUID id);
}
