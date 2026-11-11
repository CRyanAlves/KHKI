package br.com.khki.shared.api;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiErrors {

  private static final Logger logger = LoggerFactory.getLogger(ApiErrors.class);

  private ResponseEntity<ProblemDetail> error(HttpStatus status, String message) {
    return ResponseEntity.status(status).body(ProblemDetail.forStatusAndDetail(status, message));
  }

  @ExceptionHandler(ApiException.class)
  ResponseEntity<ProblemDetail> domain(ApiException exception) {
    return error(exception.status, exception.getMessage());
  }

  @ExceptionHandler({ MethodArgumentNotValidException.class, ConstraintViolationException.class, HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class })
  ResponseEntity<ProblemDetail> invalid(Exception exception) {
    return error(HttpStatus.BAD_REQUEST, "Confira os campos, formatos e limites informados.");
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<ProblemDetail> upload(Exception exception) {
    return error(HttpStatus.PAYLOAD_TOO_LARGE, "A foto deve ter no máximo 5 MB.");
  }

  @ExceptionHandler({ DataIntegrityViolationException.class, ObjectOptimisticLockingFailureException.class, jakarta.persistence.OptimisticLockException.class })
  ResponseEntity<ProblemDetail> conflict(Exception exception) {
    return error(HttpStatus.CONFLICT, "Os dados já existem ou foram alterados. Atualize e tente novamente.");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ProblemDetail> unexpected(Exception exception) {
    logger.error("Falha interna: {}", exception.getClass().getSimpleName());
    return error(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível concluir a operação.");
  }
}
