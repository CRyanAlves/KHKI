package br.com.khki.usecase.moderation;

import br.com.khki.infrastructure.storage.ImageCleanupService;
import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.shared.domain.ModeratedContent;
import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import br.com.khki.usecase.bathroom.Bathroom;
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
  private final ContributionService content;
  private final BathroomService bathroomQueries;
  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final ReportRepository reports;
  private final ModerationAuditRepository audits;

  public ModerationService(BathroomService bathroomQueries, ContributionService content, BathroomRepository bathrooms, ReviewRepository reviews, ReportRepository reports, ModerationAuditRepository audits, ImageCleanupService cleanup) {
    this.content = content;
    this.bathroomQueries = bathroomQueries;
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.reports = reports;
    this.audits = audits;
    this.cleanup = cleanup;
  }

  public List<ContributionView> queue(Status status) {
    var result = new ArrayList<ContributionView>();
    bathrooms.findByStatus(status).forEach(value -> result.add(content.contribution(value)));
    reviews.findByStatus(status).forEach(value -> result.add(content.contribution(value)));
    result.sort(Comparator.comparing(ContributionView::createdAt));
    return result;
  }

  public ModerationDetail inspect(TargetType type, UUID id) {
    var target = content.target(type, id);
    var contribution = content.contribution(target);
    var bathroom = bathrooms.findById(contribution.bathroomId()).orElseThrow(ApiException::missing);
    Object details = target instanceof Bathroom value ? bathroomQueries.view(value) : target instanceof Review review ? new ReviewView(review.getId(), content.authorName(review.getAuthorId()), review.getCleanliness(), review.getStructure(), review.getComment(), review.getCreatedAt()) : contribution;
    var pictures = imageUrls(target).stream().map(ImageUrls::id).map(ImageView::new).toList();
    return new ModerationDetail(contribution, details, content.authorName(target.getAuthorId()), target.getVersion(), bathroomQueries.view(bathroom), pictures);
  }

  public List<ModerationQueueItem> queueDetails(Status status) {
    return queue(status)
      .stream()
      .map(item -> {
        var target = content.target(item.type(), item.id());
        var bathroom = bathrooms.findById(item.bathroomId()).orElseThrow(ApiException::missing);
        UUID thumbnail = imageUrls(target).stream().map(ImageUrls::id).findFirst().orElse(null);
        return new ModerationQueueItem(item, content.authorName(target.getAuthorId()), bathroom.getAddress(), bathroom.getComplement(), bathroom.getCategory(), thumbnail, target.getVersion());
      })
      .toList();
  }

  public void decide(TargetType type, UUID id, Decision input, UUID moderatorId) {
    var target = content.target(type, id);
    checkVersion(input.expectedVersion(), target.getVersion());
    boolean valid = switch (target.getStatus()) {
      case PENDING -> input.status() == Status.APPROVED || input.status() == Status.REJECTED || input.status() == Status.NEEDS_INFORMATION;
      case NEEDS_INFORMATION -> input.status() == Status.APPROVED || input.status() == Status.REJECTED || input.status() == Status.NEEDS_INFORMATION;
      case APPROVED -> input.status() == Status.HIDDEN || input.status() == Status.REMOVED;
      case HIDDEN -> input.status() == Status.APPROVED || input.status() == Status.REMOVED;
      case REJECTED -> input.status() == Status.REMOVED;
      case REMOVED -> false;
    };
    if (!valid) throw new ApiException(HttpStatus.CONFLICT, "Este conteúdo já foi decidido ou não permite esta ação. Atualize a análise.");
    if (input.duplicateOfId() != null) {
      if (type != TargetType.BATHROOM || input.status() != Status.REJECTED || id.equals(input.duplicateOfId())) throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um cadastro existente válido para rejeitar por duplicidade.");
      bathroomQueries.approved(input.duplicateOfId());
    }
    target.setStatus(input.status());
    target.setReason(input.reason().strip());
    if (input.status() == Status.REMOVED) {
      imageUrls(target).stream().map(ImageUrls::id).forEach(cleanup::enqueue);
      imageUrls(target).clear();
    }
    recordDecision(type, target, moderatorId, target.getReason(), input.duplicateOfId());
  }

  private List<String> imageUrls(ModeratedContent target) {
    return target instanceof Bathroom bathroom ? bathroom.getImageUrls() : ((Review) target).getImageUrls();
  }

  private void recordDecision(TargetType type, ModeratedContent target, UUID moderatorId, String reason, UUID duplicateOfId) {
    var audit = new ModerationAudit();
    audit.setTargetType(type);
    audit.setTargetId(target.getId());
    audit.setModeratorId(moderatorId);
    audit.setDecision(target.getStatus());
    audit.setReason(reason);
    audit.setDuplicateOfId(duplicateOfId);
    audit.setReference(content.reference(audit.getTargetType(), audit.getTargetId()));
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
    var contribution = content.contribution(content.target(report.getTargetType(), report.getTargetId()));
    var bathroom = bathrooms.findById(contribution.bathroomId()).orElseThrow(ApiException::missing);
    return new ReportView(report.getId(), report.getTargetType(), report.getTargetId(), report.getReason(), report.getCreatedAt(), report.getResolved(), report.getVersion(), contribution.title(), bathroom.getAddress());
  }

  public void resolve(UUID id, String reason, UUID moderatorId, Long expectedVersion, Status status, Long contentVersion) {
    var report = reports.findById(id).orElseThrow(ApiException::missing);
    checkVersion(expectedVersion, report.getVersion());
    if (report.getResolved()) throw new ApiException(HttpStatus.CONFLICT, "Esta denúncia já foi encerrada. Atualize a fila.");
    checkVersion(contentVersion, content.target(report.getTargetType(), report.getTargetId()).getVersion());
    if (status != null) {
      if (status != Status.HIDDEN && status != Status.REMOVED) throw new ApiException(HttpStatus.BAD_REQUEST, "Escolha manter, ocultar ou remover o conteúdo.");
      decide(report.getTargetType(), report.getTargetId(), new Decision(status, reason, contentVersion, null), moderatorId);
    }
    report.setResolved(true);
    var audit = new ModerationAudit();
    audit.setTargetType(report.getTargetType());
    audit.setTargetId(report.getTargetId());
    audit.setModeratorId(moderatorId);
    audit.setDecision(content.target(report.getTargetType(), report.getTargetId()).getStatus());
    audit.setReason("Denúncia " + id + " encerrada: " + reason.strip());
    audit.setReference(content.reference(audit.getTargetType(), audit.getTargetId()));
    audits.save(audit);
  }

  public List<ModerationAudit> audit() {
    return audits.findAllByOrderByCreatedAtDesc();
  }

  public List<AuditView> history(TargetType type, UUID id) {
    content.target(type, id);
    return audits
      .findByTargetTypeAndTargetIdOrderByCreatedAtDesc(type, id)
      .stream()
      .map(value -> new AuditView(value.getId(), value.getTargetType(), value.getTargetId(), value.getModeratorId(), content.authorName(value.getModeratorId()), value.getDecision(), value.getReason(), value.getCreatedAt(), value.getDuplicateOfId()))
      .toList();
  }
}
