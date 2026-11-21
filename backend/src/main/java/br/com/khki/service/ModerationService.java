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

@Service @Transactional @PreAuthorize("hasRole('ADMIN')")
public class ModerationService {
    private final ContentService content;
    private final BathroomRepository bathrooms;
    private final ReviewRepository reviews;
    private final PhotoRepository photos;
    private final ReportRepository reports;
    private final ModerationAuditRepository audits;
    public ModerationService(ContentService content, BathroomRepository bathrooms, ReviewRepository reviews, PhotoRepository photos, ReportRepository reports, ModerationAuditRepository audits) { this.content = content; this.bathrooms = bathrooms; this.reviews = reviews; this.photos = photos; this.reports = reports; this.audits = audits; }
    public List<ContributionView> queue(Status status) {
        var result = new ArrayList<ContributionView>(); bathrooms.findByStatus(status).forEach(value -> result.add(content.contribution(value))); reviews.findByStatus(status).forEach(value -> result.add(content.contribution(value))); photos.findByStatus(status).forEach(value -> result.add(content.contribution(value))); result.sort(Comparator.comparing(ContributionView::createdAt)); return result;
    }
    public ModerationDetail inspect(TargetType type, UUID id) {
        var target = content.target(type, id);
        Object details = target instanceof Bathroom bathroom ? content.view(bathroom) : target instanceof Review review ? new ReviewView(review.id, "Autor da contribuição", review.cleanliness, review.structure, review.comment, review.createdAt) : content.contribution(target);
        return new ModerationDetail(content.contribution(target), details);
    }
    public void decide(TargetType type, UUID id, Decision input, UUID moderatorId) {
        var target = content.target(type, id);
        boolean valid = switch (target.status) {
            case PENDING -> input.status() == Status.APPROVED || input.status() == Status.REJECTED;
            case APPROVED -> input.status() == Status.HIDDEN || input.status() == Status.REMOVED;
            case HIDDEN -> input.status() == Status.APPROVED || input.status() == Status.REMOVED;
            case REJECTED -> input.status() == Status.REMOVED;
            case REMOVED -> false;
        };
        if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "Transição de moderação inválida.");
        target.status = input.status(); target.reason = input.reason();
        if (target instanceof Photo photo && input.status() == Status.REMOVED) photo.data = new byte[0];
        var audit = new ModerationAudit(); audit.targetType = type; audit.targetId = id; audit.moderatorId = moderatorId; audit.decision = input.status(); audit.reason = input.reason(); audits.save(audit);
    }
    public List<ReportView> reports() { return reports.findByResolvedFalseOrderByCreatedAtDesc().stream().map(value -> new ReportView(value.id, value.targetType, value.targetId, value.reason, value.createdAt)).toList(); }
    public void resolve(UUID id, String reason, UUID moderatorId) {
        var report = reports.findById(id).orElseThrow(ApiException::missing); report.resolved = true;
        var audit = new ModerationAudit(); audit.targetType = report.targetType; audit.targetId = report.targetId; audit.moderatorId = moderatorId; audit.decision = content.target(report.targetType, report.targetId).status; audit.reason = "Denúncia " + id + " encerrada: " + reason; audits.save(audit);
    }
    public List<ModerationAudit> audit() { return audits.findAllByOrderByCreatedAtDesc(); }
}
