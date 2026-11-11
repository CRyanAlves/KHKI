package br.com.khki.usecase.moderation;

import br.com.khki.shared.domain.TargetType;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModerationAuditRepository extends JpaRepository<ModerationAudit, UUID> {
  java.util.List<ModerationAudit> findAllByOrderByCreatedAtDesc();
  java.util.List<ModerationAudit> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(TargetType type, UUID id);
}
