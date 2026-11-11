package br.com.khki.usecase.report;

import br.com.khki.infrastructure.security.AbuseGuard;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.usecase.contribution.ContributionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReportService {
  private final ContributionService contributions;
  private final ReportRepository reports;
  private final AbuseGuard abuse;

  public ReportService(ContributionService contributions, ReportRepository reports, AbuseGuard abuse) {
    this.contributions = contributions;
    this.reports = reports;
    this.abuse = abuse;
  }

  public void report(ReportInput input, String remoteAddress) {
    contributions.requirePublic(input.targetType(), input.targetId());
    abuse.check("report:" + remoteAddress + ":" + input.targetId(), 1, 600);
    var report = new Report();
    report.setTargetId(input.targetId());
    report.setTargetType(input.targetType());
    report.setReason(input.reason());
    report.setReference(contributions.reference(report.getTargetType(), report.getTargetId()));
    reports.save(report);
  }
}
