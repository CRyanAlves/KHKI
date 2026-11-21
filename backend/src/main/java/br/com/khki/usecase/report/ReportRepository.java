package br.com.khki.usecase.report;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, UUID> {
  java.util.List<Report> findByResolvedFalseOrderByCreatedAtDesc();
  java.util.List<Report> findByResolvedOrderByCreatedAtDesc(boolean resolved);
}
