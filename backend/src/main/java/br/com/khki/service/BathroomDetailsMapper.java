package br.com.khki.service;

import br.com.khki.api.ApiException;
import br.com.khki.api.Contracts.BathroomDetails;
import br.com.khki.domain.Access;
import br.com.khki.domain.Bathroom;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.http.HttpStatus;

public final class BathroomDetailsMapper {

  private BathroomDetailsMapper() {}

  private static String legacyAudience(Access access) {
    return access == Access.FREE ? "PUBLIC" : access == Access.CUSTOMERS ? "CUSTOMERS" : access == Access.OTHER ? "OTHER" : "UNKNOWN";
  }

  public static BathroomDetails view(Bathroom bathroom) {
    return new BathroomDetails(
      bathroom.usageRestriction == null ? legacyAudience(bathroom.access) : bathroom.usageRestriction,
      bathroom.charging == null ? (bathroom.access == Access.PAID ? "YES" : "UNKNOWN") : bathroom.charging,
      bathroom.feeAmount,
      bathroom.bathroomTypes == null || bathroom.bathroomTypes.isBlank() ? Set.of() : new TreeSet<>(Set.of(bathroom.bathroomTypes.split(","))),
      bathroom.stepFreeAccess,
      bathroom.elevator,
      bathroom.adaptedCabin,
      bathroom.grabBars,
      bathroom.lastVisited
    );
  }

  public static void apply(Bathroom bathroom, BathroomDetails details) {
    if (details == null) return;
    String audience = details.audience() == null ? "UNKNOWN" : details.audience();
    String charge = details.charge() == null ? "UNKNOWN" : details.charge();
    if (details.feeAmount() != null && !charge.equals("YES")) throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um valor somente quando houver cobrança.");
    if (details.lastVisited() != null && details.lastVisited().isAfter(LocalDate.now(ZoneId.of("America/Sao_Paulo")))) throw new ApiException(HttpStatus.BAD_REQUEST, "A última visita não pode estar no futuro.");
    bathroom.usageRestriction = audience;
    bathroom.charging = charge;
    bathroom.feeAmount = details.feeAmount();
    bathroom.bathroomTypes = details.bathroomTypes() == null ? "" : String.join(",", new TreeSet<>(details.bathroomTypes()));
    bathroom.stepFreeAccess = details.stepFreeAccess();
    bathroom.elevator = details.elevator();
    bathroom.adaptedCabin = details.adaptedCabin();
    bathroom.grabBars = details.grabBars();
    bathroom.lastVisited = details.lastVisited();
    bathroom.access = audience.equals("CUSTOMERS") ? Access.CUSTOMERS : audience.equals("PUBLIC") && !charge.equals("YES") ? Access.FREE : charge.equals("YES") && !audience.equals("AUTHORIZATION") && !audience.equals("OTHER") ? Access.PAID : Access.OTHER;
  }
}
