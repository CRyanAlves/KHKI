package br.com.khki.service;

import br.com.khki.api.*;
import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.repository.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@PreAuthorize("hasRole('ADMIN')")
public class ModerationService {

  private final ContentService content;
  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final PhotoRepository photos;
  private final ReportRepository reports;
  private final ModerationAuditRepository audits;

  public ModerationService(ContentService content, BathroomRepository bathrooms, ReviewRepository reviews, PhotoRepository photos, ReportRepository reports, ModerationAuditRepository audits) {
    this.content = content;
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.photos = photos;
    this.reports = reports;
    this.audits = audits;
  }

  public List<ContributionView> queue(Status status) {
    var result = new ArrayList<ContributionView>();
    bathrooms.findByStatus(status).forEach(value -> result.add(content.contribution(value)));
    reviews.findByStatus(status).forEach(value -> result.add(content.contribution(value)));
    photos.findByStatus(status).forEach(value -> result.add(content.contribution(value)));
    result.sort(Comparator.comparing(ContributionView::createdAt));
    return result;
  }

  public ModerationDetail inspect(TargetType type, UUID id) {
    var target = content.target(type, id);
    var contribution = content.contribution(target);
    var bathroom = bathrooms.findById(contribution.bathroomId()).orElseThrow(ApiException::missing);
    Object details = target instanceof Bathroom value ? content.view(value) : target instanceof Review review ? new ReviewView(review.id, content.authorName(review.authorId), review.cleanliness, review.structure, review.comment, review.createdAt) : contribution;
    var pictures = photos
      .findByBathroomIdAndStatusNotOrderByCreatedAtDesc(bathroom.id, Status.REMOVED)
      .stream()
      .filter(photo -> !(target instanceof Review) || Objects.equals(photo.reviewId, target.id))
      .map(content::contribution)
      .toList();
    return new ModerationDetail(contribution, details, content.authorName(target.authorId), target.version, content.view(bathroom), pictures);
  }

  public List<ModerationQueueItem> queueDetails(Status status) {
    return queue(status)
      .stream()
      .map(item -> {
        var target = content.target(item.type(), item.id());
        var bathroom = bathrooms.findById(item.bathroomId()).orElseThrow(ApiException::missing);
        var pictures = photos.findByBathroomIdAndStatusNotOrderByCreatedAtDesc(bathroom.id, Status.REMOVED);
        UUID thumbnail =
          item.type() == TargetType.PHOTO && status != Status.REMOVED
            ? item.id()
            : pictures
                .stream()
                .filter(photo -> photo.status != Status.REJECTED && photo.status != Status.HIDDEN)
                .map(photo -> photo.id)
                .findFirst()
                .orElse(null);
        return new ModerationQueueItem(item, content.authorName(target.authorId), bathroom.address, bathroom.complement, bathroom.category, thumbnail, target.version);
      })
      .toList();
  }

  public void decide(TargetType type, UUID id, Decision input, UUID moderatorId) {
    var target = content.target(type, id);
    checkVersion(input.expectedVersion(), target.version);
    boolean valid = switch (target.status) {
      case PENDING -> input.status() == Status.APPROVED || input.status() == Status.REJECTED || (input.status() == Status.NEEDS_INFORMATION && type != TargetType.PHOTO);
      case NEEDS_INFORMATION -> input.status() == Status.APPROVED || input.status() == Status.REJECTED || input.status() == Status.NEEDS_INFORMATION;
      case APPROVED -> input.status() == Status.HIDDEN || input.status() == Status.REMOVED;
      case HIDDEN -> input.status() == Status.APPROVED || input.status() == Status.REMOVED;
      case REJECTED -> input.status() == Status.REMOVED;
      case REMOVED -> false;
    };
    if (!valid) throw new ApiException(HttpStatus.CONFLICT, "Este conteúdo já foi decidido ou não permite esta ação. Atualize a análise.");
    if (input.duplicateOfId() != null) {
      if (type != TargetType.BATHROOM || input.status() != Status.REJECTED || id.equals(input.duplicateOfId())) throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um cadastro existente válido para rejeitar por duplicidade.");
      content.approved(input.duplicateOfId());
    }
    target.status = input.status();
    target.reason = input.reason().strip();
    if (target instanceof Photo photo && input.status() == Status.REMOVED) photo.data = new byte[0];
    var audit = new ModerationAudit();
    audit.targetType = type;
    audit.targetId = id;
    audit.moderatorId = moderatorId;
    audit.decision = input.status();
    audit.reason = target.reason;
    audit.duplicateOfId = input.duplicateOfId();
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
    var contribution = content.contribution(content.target(report.targetType, report.targetId));
    var bathroom = bathrooms.findById(contribution.bathroomId()).orElseThrow(ApiException::missing);
    return new ReportView(report.id, report.targetType, report.targetId, report.reason, report.createdAt, report.resolved, report.version, contribution.title(), bathroom.address);
  }

  public void resolve(UUID id, String reason, UUID moderatorId, Long expectedVersion, Status status, Long contentVersion) {
    var report = reports.findById(id).orElseThrow(ApiException::missing);
    checkVersion(expectedVersion, report.version);
    if (report.resolved) throw new ApiException(HttpStatus.CONFLICT, "Esta denúncia já foi encerrada. Atualize a fila.");
    checkVersion(contentVersion, content.target(report.targetType, report.targetId).version);
    if (status != null) {
      if (status != Status.HIDDEN && status != Status.REMOVED) throw new ApiException(HttpStatus.BAD_REQUEST, "Escolha manter, ocultar ou remover o conteúdo.");
      decide(report.targetType, report.targetId, new Decision(status, reason, contentVersion, null), moderatorId);
    }
    report.resolved = true;
    var audit = new ModerationAudit();
    audit.targetType = report.targetType;
    audit.targetId = report.targetId;
    audit.moderatorId = moderatorId;
    audit.decision = content.target(report.targetType, report.targetId).status;
    audit.reason = "Denúncia " + id + " encerrada: " + reason.strip();
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
      .map(value -> new AuditView(value.id, value.targetType, value.targetId, value.moderatorId, content.authorName(value.moderatorId), value.decision, value.reason, value.createdAt, value.duplicateOfId))
      .toList();
  }
}
