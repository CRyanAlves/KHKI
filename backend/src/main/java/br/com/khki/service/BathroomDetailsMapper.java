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
      bathroom.getUsageRestriction() == null ? legacyAudience(bathroom.getAccess()) : bathroom.getUsageRestriction(),
      bathroom.getCharging() == null ? (bathroom.getAccess() == Access.PAID ? "YES" : "UNKNOWN") : bathroom.getCharging(),
      bathroom.getFeeAmount(),
      new TreeSet<>(bathroom.getBathroomTypes()),
      bathroom.getStepFreeAccess(),
      bathroom.getElevator(),
      bathroom.getAdaptedCabin(),
      bathroom.getGrabBars(),
      bathroom.getLastVisited()
    );
  }

  public static void apply(Bathroom bathroom, BathroomDetails details) {
    if (details == null) return;
    String audience = details.audience() == null ? "UNKNOWN" : details.audience();
    String charge = details.charge() == null ? "UNKNOWN" : details.charge();
    if (details.feeAmount() != null && !charge.equals("YES")) throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um valor somente quando houver cobrança.");
    if (details.lastVisited() != null && details.lastVisited().isAfter(LocalDate.now(ZoneId.of("America/Sao_Paulo")))) throw new ApiException(HttpStatus.BAD_REQUEST, "A última visita não pode estar no futuro.");
    bathroom.setUsageRestriction(audience);
    bathroom.setCharging(charge);
    bathroom.setFeeAmount(details.feeAmount());
    bathroom.setBathroomTypes(details.bathroomTypes() == null ? new TreeSet<>() : new TreeSet<>(details.bathroomTypes()));
    bathroom.setStepFreeAccess(details.stepFreeAccess());
    bathroom.setElevator(details.elevator());
    bathroom.setAdaptedCabin(details.adaptedCabin());
    bathroom.setGrabBars(details.grabBars());
    bathroom.setLastVisited(details.lastVisited());
    bathroom.setAccess(audience.equals("CUSTOMERS") ? Access.CUSTOMERS : audience.equals("PUBLIC") && !charge.equals("YES") ? Access.FREE : charge.equals("YES") && !audience.equals("AUTHORIZATION") && !audience.equals("OTHER") ? Access.PAID : Access.OTHER);
  }
}
