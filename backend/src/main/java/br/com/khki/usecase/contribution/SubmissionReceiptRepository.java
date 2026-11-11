package br.com.khki.usecase.contribution;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubmissionReceiptRepository extends JpaRepository<SubmissionReceipt, UUID> {}
