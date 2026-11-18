package br.com.khki.usecase.report.service;

import br.com.khki.infrastructure.security.AbuseGuard;
import br.com.khki.shared.domain.ContentReference;
import br.com.khki.usecase.contribution.service.ContributionService;
import br.com.khki.usecase.report.dto.ReportInput;
import br.com.khki.usecase.report.model.Report;
import br.com.khki.usecase.report.model.repository.ReportRepository;
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
    var target = contributions.requirePublic(input.targetType(), input.targetId());
    abuse.check("report:" + remoteAddress + ":" + input.targetId(), 1, 600);
    var report = new Report();
    report.setTargetId(input.targetId());
    report.setTargetType(input.targetType());
    report.setReason(input.reason());
    report.setReference(ContentReference.of(target));
    reports.save(report);
  }
}
