package br.com.khki.usecase.moderation.model.repository;

import br.com.khki.usecase.moderation.model.ModerationAudit;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModerationAuditRepository extends JpaRepository<ModerationAudit, UUID> {
  List<ModerationAudit> findAllByOrderByCreatedAtDesc();
  List<ModerationAudit> findByReference_Bathroom_IdOrderByCreatedAtDesc(UUID id);
  List<ModerationAudit> findByReference_Review_IdOrderByCreatedAtDesc(UUID id);
}
