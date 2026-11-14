package br.com.khki.usecase.moderation;

import br.com.khki.infrastructure.storage.ImageCleanupService;
import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.shared.domain.BaseModeratedEntity;
import br.com.khki.shared.domain.ContentReference;
import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import br.com.khki.usecase.bathroom.Bathroom;
import br.com.khki.usecase.account.UserRepository;
import br.com.khki.usecase.bathroom.BathroomRepository;
import br.com.khki.usecase.bathroom.BathroomService;
import br.com.khki.usecase.contribution.ContributionService;
import br.com.khki.usecase.image.ImageUrls;
import br.com.khki.usecase.report.Report;
import br.com.khki.usecase.report.ReportRepository;
import br.com.khki.usecase.review.Review;
import br.com.khki.usecase.review.ReviewRepository;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@PreAuthorize("hasRole('ADMIN')")
public class ModerationService {

  private final ImageCleanupService cleanup;
  private final UserRepository users;
  private final ContributionService content;
  private final BathroomService bathroomQueries;
  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final ReportRepository reports;
  private final ModerationAuditRepository audits;

  public ModerationService(BathroomService bathroomQueries, ContributionService content, BathroomRepository bathrooms, ReviewRepository reviews, ReportRepository reports, ModerationAuditRepository audits, ImageCleanupService cleanup, UserRepository users) {
    this.content = content;
    this.bathroomQueries = bathroomQueries;
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.reports = reports;
    this.audits = audits;
    this.cleanup = cleanup;
    this.users = users;
  }

  private List<BaseModeratedEntity> contents(Status status) {
    var result = new ArrayList<BaseModeratedEntity>();
    result.addAll(bathrooms.findByStatus(status));
    result.addAll(reviews.findByStatus(status));
    result.sort(Comparator.comparing(BaseModeratedEntity::getCreatedAt));
    return result;
  }

  public List<ContributionView> queue(Status status) {
    return contents(status).stream().map(content::contribution).toList();
  }

  public ModerationDetail inspect(TargetType type, UUID id) {
    var target = content.target(type, id);
    var contribution = content.contribution(target);
    var bathroomView = bathroomQueries.view(content.bathroom(target));
    Object details = target instanceof Bathroom ? bathroomView : target instanceof Review review ? new ReviewView(review.getId(), review.getAuthor().getName(), review.getCleanliness(), review.getStructure(), review.getComment(), review.getCreatedAt()) : contribution;
    var pictures = target.getImageUrls().stream().map(ImageUrls::id).map(ImageView::new).toList();
    return new ModerationDetail(contribution, details, target.getAuthor().getName(), target.getVersion(), bathroomView, pictures);
  }

  public List<ModerationQueueItem> queueDetails(Status status) {
    return contents(status)
      .stream()
      .map(target -> {
        var item = content.contribution(target);
        var bathroom = content.bathroom(target);
        UUID thumbnail = target.getImageUrls().stream().map(ImageUrls::id).findFirst().orElse(null);
        return new ModerationQueueItem(item, target.getAuthor().getName(), bathroom.getAddress(), bathroom.getComplement(), bathroom.getCategory(), thumbnail, target.getVersion());
      })
      .toList();
  }

  public void decide(TargetType type, UUID id, Decision input, UUID moderatorId) {
    var target = content.target(type, id);
    checkVersion(input.expectedVersion(), target.getVersion());
    boolean valid = switch (target.getStatus()) {
      case PENDING, NEEDS_INFORMATION -> input.status() == Status.APPROVED || input.status() == Status.REJECTED || input.status() == Status.NEEDS_INFORMATION;
      case APPROVED -> input.status() == Status.HIDDEN || input.status() == Status.REMOVED;
      case HIDDEN -> input.status() == Status.APPROVED || input.status() == Status.REMOVED;
      case REJECTED -> input.status() == Status.REMOVED;
      case REMOVED -> false;
    };
    if (!valid) throw new ApiException(HttpStatus.CONFLICT, "Este conteúdo já foi decidido ou não permite esta ação. Atualize a análise.");
    Bathroom duplicateOf = null;
    if (input.duplicateOfId() != null) {
      if (type != TargetType.BATHROOM || input.status() != Status.REJECTED || id.equals(input.duplicateOfId())) throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um cadastro existente válido para rejeitar por duplicidade.");
      duplicateOf = bathroomQueries.approved(input.duplicateOfId());
    }
    target.setStatus(input.status());
    target.setReason(input.reason().strip());
    if (input.status() == Status.REMOVED) {
      target.getImageUrls().stream().map(ImageUrls::id).forEach(cleanup::enqueue);
      target.getImageUrls().clear();
    }
    recordDecision(target, moderatorId, target.getReason(), duplicateOf);
  }

  private void recordDecision(BaseModeratedEntity target, UUID moderatorId, String reason, Bathroom duplicateOf) {
    var audit = new ModerationAudit();
    audit.setModerator(users.findById(moderatorId).orElseThrow(ApiException::missing));
    audit.setDecision(target.getStatus());
    audit.setReason(reason);
    audit.setDuplicateOf(duplicateOf);
    audit.setReference(ContentReference.of(target));
    audits.save(audit);
  }

  private void checkVersion(Long expected, long actual) {
    if (expected != null && expected != actual) throw new ApiException(HttpStatus.CONFLICT, "Outro administrador ou o autor alterou este item. Atualize a análise antes de decidir.");
  }

  public List<ReportView> reports(boolean resolved) {
    return reports.findByResolvedOrderByCreatedAtDesc(resolved).stream().map(this::reportView).toList();
  }

  public ReportView report(UUID id) {
    return reportView(reports.findById(id).orElseThrow(ApiException::missing));
  }

  private ReportView reportView(Report report) {
    var target = content.target(report.getTargetType(), report.getTargetId());
    var contribution = content.contribution(target);
    var bathroom = content.bathroom(target);
    return new ReportView(report.getId(), report.getTargetType(), report.getTargetId(), report.getReason(), report.getCreatedAt(), report.getResolved(), report.getVersion(), contribution.title(), bathroom.getAddress());
  }

  public void resolve(UUID id, String reason, UUID moderatorId, Long expectedVersion, Status status, Long contentVersion) {
    var report = reports.findById(id).orElseThrow(ApiException::missing);
    checkVersion(expectedVersion, report.getVersion());
    if (report.getResolved()) throw new ApiException(HttpStatus.CONFLICT, "Esta denúncia já foi encerrada. Atualize a fila.");
    var target = content.target(report.getTargetType(), report.getTargetId());
    checkVersion(contentVersion, target.getVersion());
    if (status != null) {
      if (status != Status.HIDDEN && status != Status.REMOVED) throw new ApiException(HttpStatus.BAD_REQUEST, "Escolha manter, ocultar ou remover o conteúdo.");
      decide(report.getTargetType(), report.getTargetId(), new Decision(status, reason, contentVersion, null), moderatorId);
    }
    report.setResolved(true);
    recordDecision(target, moderatorId, "Denúncia " + id + " encerrada: " + reason.strip(), null);
  }

  public List<AuditEntryView> audit() {
    return audits.findAllByOrderByCreatedAtDesc().stream().map(value -> new AuditEntryView(value.getId(), value.getTargetType(), value.getTargetId(), value.getModerator().getId(), value.getDuplicateOf() == null ? null : value.getDuplicateOf().getId(), value.getDecision(), value.getReason(), value.getCreatedAt())).toList();
  }

  public List<AuditView> history(TargetType type, UUID id) {
    content.target(type, id);
    var history = switch (type) {
      case BATHROOM -> audits.findByReference_Bathroom_IdOrderByCreatedAtDesc(id);
      case REVIEW -> audits.findByReference_Review_IdOrderByCreatedAtDesc(id);
    };
    return history
      .stream()
      .map(value -> new AuditView(value.getId(), value.getTargetType(), value.getTargetId(), value.getModerator().getId(), value.getModerator().getName(), value.getDecision(), value.getReason(), value.getCreatedAt(), value.getDuplicateOf() == null ? null : value.getDuplicateOf().getId()))
      .toList();
  }
}
