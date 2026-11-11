package br.com.khki.service;

import br.com.khki.api.*;
import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.repository.*;
import br.com.khki.storage.ImageCleanupService;
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
  private final ContentService content;
  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final ImageRepository photos;
  private final ReportRepository reports;
  private final ModerationAuditRepository audits;

  public ModerationService(ContentService content, BathroomRepository bathrooms, ReviewRepository reviews, ImageRepository photos, ReportRepository reports, ModerationAuditRepository audits, ImageCleanupService cleanup) {
    this.content = content;
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.photos = photos;
    this.reports = reports;
    this.audits = audits;
    this.cleanup = cleanup;
  }

  public List<ContributionView> queue(Status status) {
    var result = new ArrayList<ContributionView>();
    bathrooms.findByStatus(status).forEach(value -> result.add(content.contribution(value)));
    reviews.findByStatus(status).stream().filter(review -> !review.getPhotoOnly()).forEach(value -> result.add(content.contribution(value)));
    photos.findByStatusAndReviewIdIsNullAndRegistrationAttachmentFalse(status).forEach(value -> result.add(content.contribution(value)));
    if (status == Status.PENDING) {
      var included = new HashSet<UUID>();
      result.forEach(item -> included.add(item.id()));
      for (ImageContribution photo : photos.findByStatus(Status.PENDING)) {
        ModeratedContent parent = photo.getReviewId() != null ? reviews.findById(photo.getReviewId()).orElse(null) : photo.getRegistrationAttachment() ? bathrooms.findById(photo.getBathroomId()).orElse(null) : null;
        if (parent != null && parent.getStatus() == Status.APPROVED && included.add(parent.getId())) result.add(content.contribution(parent));
      }
    }
    result.sort(Comparator.comparing(ContributionView::createdAt));
    return result;
  }

  public ModerationDetail inspect(TargetType type, UUID id) {
    var target = content.target(type, id);
    var contribution = content.contribution(target);
    var bathroom = bathrooms.findById(contribution.bathroomId()).orElseThrow(ApiException::missing);
    Object details = target instanceof Bathroom value ? content.view(value) : target instanceof Review review ? new ReviewView(review.getId(), content.authorName(review.getAuthorId()), review.getCleanliness(), review.getStructure(), review.getComment(), review.getCreatedAt()) : contribution;
    var pictures = photos
      .findByBathroomIdAndStatusNotOrderByCreatedAtDesc(bathroom.getId(), Status.REMOVED)
      .stream()
      .filter(photo -> attachedTo(photo, target))
      .map(content::contribution)
      .toList();
    return new ModerationDetail(contribution, details, content.authorName(target.getAuthorId()), target.getVersion(), content.view(bathroom), pictures);
  }

  public List<ModerationQueueItem> queueDetails(Status status) {
    return queue(status)
      .stream()
      .map(item -> {
        var target = content.target(item.type(), item.id());
        var bathroom = bathrooms.findById(item.bathroomId()).orElseThrow(ApiException::missing);
        var pictures = photos.findByBathroomIdAndStatusNotOrderByCreatedAtDesc(bathroom.getId(), Status.REMOVED);
        UUID thumbnail =
          item.type() == TargetType.PHOTO && status != Status.REMOVED
            ? item.id()
            : pictures
                .stream()
                .filter(photo -> attachedTo(photo, target) && photo.getStatus() != Status.REJECTED && photo.getStatus() != Status.HIDDEN)
                .map(photo -> photo.getId())
                .findFirst()
                .orElse(null);
        return new ModerationQueueItem(item, content.authorName(target.getAuthorId()), bathroom.getAddress(), bathroom.getComplement(), bathroom.getCategory(), thumbnail, target.getVersion());
      })
      .toList();
  }

  public void decide(TargetType type, UUID id, Decision input, UUID moderatorId) {
    var target = content.target(type, id);
    checkVersion(input.expectedVersion(), target.getVersion());
    boolean valid = switch (target.getStatus()) {
      case PENDING -> input.status() == Status.APPROVED || input.status() == Status.REJECTED || (input.status() == Status.NEEDS_INFORMATION && type != TargetType.PHOTO);
      case NEEDS_INFORMATION -> input.status() == Status.APPROVED || input.status() == Status.REJECTED || input.status() == Status.NEEDS_INFORMATION;
      case APPROVED -> input.status() == Status.HIDDEN || input.status() == Status.REMOVED || (input.status() == Status.APPROVED && type != TargetType.PHOTO && hasPendingAttachments(target));
      case HIDDEN -> input.status() == Status.APPROVED || input.status() == Status.REMOVED;
      case REJECTED -> input.status() == Status.REMOVED;
      case REMOVED -> false;
    };
    if (!valid) throw new ApiException(HttpStatus.CONFLICT, "Este conteúdo já foi decidido ou não permite esta ação. Atualize a análise.");
    if (input.duplicateOfId() != null) {
      if (type != TargetType.BATHROOM || input.status() != Status.REJECTED || id.equals(input.duplicateOfId())) throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um cadastro existente válido para rejeitar por duplicidade.");
      content.approved(input.duplicateOfId());
    }
    target.setStatus(input.status());
    target.setReason(input.reason().strip());
    if (target instanceof ImageContribution photo) {
      photos.save(photo);
      if (input.status() == Status.REMOVED) cleanup.enqueue(photo.getId());
    }
    recordDecision(type, target, moderatorId, target.getReason(), input.duplicateOfId());
    if (input.status() == Status.APPROVED && !(target instanceof ImageContribution)) {
      UUID bathroomId = target instanceof Bathroom ? target.getId() : ((Review) target).getBathroomId();
      for (ImageContribution photo : photos.findByBathroomIdAndStatus(bathroomId, Status.PENDING)) {
        if (!attachedTo(photo, target)) continue;
        photo.setStatus(Status.APPROVED);
        photo.setReason("Aprovada junto com " + (type == TargetType.BATHROOM ? "o cadastro do banheiro " : "a avaliação ") + id + ".");
        photos.save(photo);
        recordDecision(TargetType.PHOTO, photo, moderatorId, photo.getReason(), null);
      }
    }
  }

  private boolean hasPendingAttachments(ModeratedContent target) {
    UUID bathroomId = target instanceof Bathroom ? target.getId() : ((Review) target).getBathroomId();
    return photos
      .findByBathroomIdAndStatus(bathroomId, Status.PENDING)
      .stream()
      .anyMatch(photo -> attachedTo(photo, target));
  }

  private boolean attachedTo(ImageContribution photo, ModeratedContent target) {
    if (target instanceof Review) return Objects.equals(photo.getReviewId(), target.getId());
    if (target instanceof Bathroom) return photo.getRegistrationAttachment() && photo.getReviewId() == null && photo.getBathroomId().equals(target.getId());
    return photo.getId().equals(target.getId());
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
