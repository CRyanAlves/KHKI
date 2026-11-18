package br.com.khki.usecase.report.controller;

import br.com.khki.usecase.report.dto.ReportInput;
import br.com.khki.usecase.report.service.ReportService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Validated
public class ReportController {

  private final ReportService reports;

  public ReportController(ReportService reports) {
    this.reports = reports;
  }

  @PostMapping("/reports")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, String> report(@Valid @RequestBody ReportInput input, HttpServletRequest request) {
    reports.report(input, request.getRemoteAddr());
    return Map.of("message", "Denúncia recebida para análise.");
  }
}
