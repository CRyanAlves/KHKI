package br.com.khki;

import br.com.khki.infrastructure.security.AbuseGuard;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.shared.domain.ContentReference;
import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import br.com.khki.usecase.account.User;
import br.com.khki.usecase.account.UserRepository;
import br.com.khki.usecase.bathroom.AccessType;
import br.com.khki.usecase.bathroom.Bathroom;
import br.com.khki.usecase.bathroom.BathroomRepository;
import br.com.khki.usecase.moderation.ModerationAuditRepository;
import br.com.khki.usecase.report.Report;
import br.com.khki.usecase.report.ReportRepository;
import br.com.khki.usecase.review.ReviewRepository;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.*;
import org.springframework.test.web.servlet.*;

@SpringBootTest(properties = { "spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:workflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE}", "spring.datasource.username=${TEST_DATABASE_USER:sa}", "spring.datasource.password=${TEST_DATABASE_PASSWORD:}", "khki.admin-email=admin@khki.test", "khki.admin-password=Test-admin-password-123", "khki.demo=false" })
@AutoConfigureMockMvc
class WorkflowTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper json;

  @Autowired
  BathroomRepository bathrooms;

  @Autowired
  ReviewRepository reviews;

  @Autowired
  UserRepository users;

  @Autowired
  ModerationAuditRepository audits;

  @Autowired
  ReportRepository reports;

  @Autowired
  AbuseGuard abuse;

  @Autowired
  br.com.khki.infrastructure.storage.ImageStorage imageStorage;

  @Autowired
  org.springframework.jdbc.core.JdbcTemplate jdbc;

  @BeforeEach
  void isolateRateLimitState() {
    ((java.util.Map<?, ?>) org.springframework.test.util.ReflectionTestUtils.getField(abuse, "buckets")).clear();
  }

  @Test
  void publicSearchPaginatesBeforeClientFiltersWithoutExposingPendingContent() throws Exception {
    var created = new java.util.ArrayList<Bathroom>();
    var author = users.findAll().get(0).getId();
    for (int index = 0; index < 202; index++) {
      var bathroom = new Bathroom();
      bathroom.setAuthorId(author);
      bathroom.setName("Paginação dos filtros " + index);
      bathroom.setAddress("Endereço de teste");
      bathroom.setCategory("Biblioteca");
      bathroom.setAccess(AccessType.FREE);
      bathroom.setStatus(index == 201 ? Status.PENDING : Status.APPROVED);
      created.add(bathroom);
    }
    bathrooms.saveAll(created);
    try {
      var first = body(mvc.perform(get("/api/bathrooms").param("q", "Paginação dos filtros")).andExpect(status().isOk()).andReturn());
      var second = body(mvc.perform(get("/api/bathrooms").param("q", "Paginação dos filtros").param("offset", "200")).andExpect(status().isOk()).andReturn());
      assertThat(first.size()).isEqualTo(200);
      assertThat(second.size()).isEqualTo(1);
      var ids = new java.util.HashSet<String>();
      first.forEach(value -> ids.add(value.get("id").asText()));
      assertThat(ids).doesNotContain(second.get(0).get("id").asText(), created.get(201).getId().toString());
      mvc.perform(get("/api/bathrooms").param("offset", "-1")).andExpect(status().isBadRequest());
      mvc.perform(get("/api/bathrooms").param("offset", "100001")).andExpect(status().isBadRequest());
      mvc.perform(get("/api/bathrooms").param("offset", "invalid")).andExpect(status().isBadRequest());
    } finally {
      bathrooms.deleteAll(created);
    }
  }

  private JsonNode body(MvcResult result) throws Exception {
    return json.readTree(result.getResponse().getContentAsString());
  }

  private String bathroomInput(String name) {
    return "{\"name\":\"" + name + "\",\"address\":\"Rua de teste, 100, São Paulo\",\"category\":\"Café\",\"latitude\":-23.55,\"longitude\":-46.65,\"access\":\"FREE\",\"accessible\":true,\"items\":[\"SOAP\",\"SINK\"]}";
  }

  private jakarta.servlet.http.Cookie login(String email, String password) throws Exception {
    return mvc
      .perform(
        post("/api/auth/login")
          .with(csrf())
          .contentType("application/json")
          .content(json.writeValueAsString(java.util.Map.of("email", email, "password", password)))
      )
      .andExpect(status().isOk())
      .andReturn()
      .getResponse()
      .getCookie("KHKI_SESSION");
  }

  private void decide(String type, UUID id, String status) throws Exception {
    mvc
      .perform(
        post("/api/admin/content/" + type + "/" + id + "/decision")
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
          .contentType("application/json")
          .content("{\"status\":\"" + status + "\",\"reason\":\"Análise humana registrada\"}")
      )
      .andExpect(status().isOk());
  }

  @Test
  void completeModeratedWorkflowAndPrivacy() throws Exception {
    String email = "user-" + UUID.randomUUID() + "@khki.test";
    mvc
      .perform(
        post("/api/auth/register")
          .with(csrf())
          .contentType("application/json")
          .content(json.writeValueAsString(java.util.Map.of("name", "Pessoa de teste", "email", email, "password", "Test-user-password-123")))
      )
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.role").value("USER"))
      .andExpect(jsonPath("$.password").doesNotExist());
    var session = login(email, "Test-user-password-123");
    UUID bathroomId = UUID.fromString(
      body(
        mvc
          .perform(post("/api/bathrooms").cookie(session).with(csrf()).contentType("application/json").content(bathroomInput("Banheiro de teste")))
          .andExpect(status().isCreated())
          .andExpect(jsonPath("$.status").value("PENDING"))
          .andReturn()
      )
        .get("id")
        .asText()
    );
    mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(status().isNotFound());
    mvc.perform(get("/api/bathrooms").param("q", "Banheiro de teste")).andExpect(content().json("[]"));
    mvc.perform(get("/api/admin/queue")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/admin/queue").cookie(session)).andExpect(status().isForbidden());
    mvc
      .perform(
        post("/api/admin/content/BATHROOM/" + bathroomId + "/decision")
          .cookie(session)
          .with(csrf())
          .contentType("application/json")
          .content("{\"status\":\"APPROVED\",\"reason\":\"Tentativa indevida\"}")
      )
      .andExpect(status().isForbidden());
    var image = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", image);
    var upload = new MockMultipartFile("file", "banheiro.png", "image/png", image.toByteArray());
    mvc.perform(multipart("/api/bathrooms/" + bathroomId + "/photos").file(upload).param("registrationAttachment", "true").cookie(session).with(csrf())).andExpect(status().isCreated());
    UUID photoId = imageId("bathrooms", bathroomId);
    mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isNotFound());
    mvc
      .perform(get("/api/photos/" + photoId).cookie(session))
      .andExpect(status().isOk())
      .andExpect(content().contentType("image/jpeg"));
    mvc.perform(get("/api/photos/" + photoId).with(user("other@khki.test"))).andExpect(status().isNotFound());
    decide("BATHROOM", bathroomId, "APPROVED");
    mvc
      .perform(get("/api/bathrooms/" + bathroomId))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.photoIds.length()").value(1))
      .andExpect(jsonPath("$.rating").isEmpty());
    mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isOk());
    UUID reviewId = UUID.fromString(
      body(
        mvc
          .perform(
            post("/api/bathrooms/" + bathroomId + "/reviews")
              .cookie(session)
              .with(csrf())
              .contentType("application/json")
              .content("{\"cleanliness\":1,\"structure\":2,\"comment\":\"Experiência negativa, precisa melhorar.\"}")
          )
          .andExpect(status().isCreated())
          .andReturn()
      )
        .get("id")
        .asText()
    );
    mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(jsonPath("$.reviewCount").value(0));
    decide("REVIEW", reviewId, "APPROVED");
    mvc
      .perform(get("/api/bathrooms/" + bathroomId))
      .andExpect(jsonPath("$.reviewCount").value(1))
      .andExpect(jsonPath("$.rating").value(1.5));
    decide("REVIEW", reviewId, "HIDDEN");
    mvc
      .perform(get("/api/bathrooms/" + bathroomId))
      .andExpect(jsonPath("$.reviewCount").value(0))
      .andExpect(jsonPath("$.rating").isEmpty());
    decide("REVIEW", reviewId, "APPROVED");
    long reportCount = reports.count();
    for (String targetType : java.util.List.of("BATHROOM", "REVIEW", "PHOTO")) {
      mvc
        .perform(
          post("/api/reports")
            .with(csrf())
            .contentType("application/json")
            .content("{\"targetType\":\"" + targetType + "\",\"targetId\":\"" + bathroomId + "\",\"reason\":\"INCORRECT\"}")
        )
        .andExpect(status().isUnauthorized());
    }
    assertThat(reports.count()).isEqualTo(reportCount);
    mvc
      .perform(
        post("/api/reports")
          .with(user("reporter@khki.test"))
          .with(csrf())
          .contentType("application/json")
          .content("{\"targetType\":\"BATHROOM\",\"targetId\":\"" + bathroomId + "\",\"reason\":\"INCORRECT\"}")
      )
      .andExpect(status().isAccepted());
    mvc
      .perform(
        post("/api/reports")
          .with(user("reporter@khki.test"))
          .with(csrf())
          .contentType("application/json")
          .content("{\"targetType\":\"BATHROOM\",\"targetId\":\"" + bathroomId + "\",\"reason\":\"INCORRECT\"}")
      )
      .andExpect(status().isTooManyRequests());
    decide("BATHROOM", bathroomId, "HIDDEN");
    mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(status().isNotFound());
    mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isNotFound());
    mvc.perform(get("/api/bathrooms/" + bathroomId + "/reviews")).andExpect(status().isNotFound());
    decide("BATHROOM", bathroomId, "APPROVED");
    decide("BATHROOM", bathroomId, "REMOVED");
    mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isNotFound());
    assertThat(audits.count()).isGreaterThanOrEqualTo(6);
    mvc.perform(get("/api/me/contributions").cookie(session)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    mvc.perform(post("/api/auth/logout").cookie(session).with(csrf())).andExpect(status().isNoContent());
  }

  @Test
  void rejectsInvalidInputsAndRequiresCsrf() throws Exception {
    mvc.perform(post("/api/auth/register").contentType("application/json").content("{}")).andExpect(status().isForbidden());
    mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content("{\"name\":\"Teste\",\"email\":\"invalid\",\"password\":\"123\"}")).andExpect(status().isBadRequest());
    mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Inválido").replace("-23.55", "999"))).andExpect(status().isBadRequest());
    mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Inválido").replace("SOAP", "<script>"))).andExpect(status().isBadRequest());
    mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\"admin@khki.test\",\"password\":\"incorrect\"}")).andExpect(status().isUnauthorized());
  }

  @Test
  void rejectsDisguisedUploads() throws Exception {
    var admin = users.findByEmail("admin@khki.test").orElseThrow();
    var bathroom = new Bathroom();
    bathroom.setAuthorId(admin.getId());
    bathroom.setName("Upload");
    bathroom.setAddress("Teste");
    bathroom.setCategory("Teste");
    bathroom.setAccess(AccessType.FREE);
    bathroom.setStatus(Status.PENDING);
    bathrooms.save(bathroom);
    mvc
      .perform(
        multipart("/api/bathrooms/" + bathroom.getId() + "/photos")
          .file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", "<script>alert(1)</script>".getBytes()))
          .param("registrationAttachment", "true")
          .with(user(admin.getEmail()).roles("ADMIN"))
          .with(csrf())
      )
      .andExpect(status().isBadRequest());
  }

  @Test
  void rejectedContributionCanOnlyBeResubmittedByAuthor() throws Exception {
    var admin = users.findByEmail("admin@khki.test").orElseThrow();
    var bathroom = new Bathroom();
    bathroom.setAuthorId(admin.getId());
    bathroom.setName("Rejeitado");
    bathroom.setAddress("Teste");
    bathroom.setCategory("Teste");
    bathroom.setAccess(AccessType.FREE);
    bathroom.setStatus(Status.REJECTED);
    bathroom.setReason("Corrigir endereço");
    bathrooms.save(bathroom);
    mvc
      .perform(
        put("/api/bathrooms/" + bathroom.getId())
          .with(user(admin.getEmail()).roles("ADMIN"))
          .with(csrf())
          .contentType("application/json")
          .content(bathroomInput("Corrigido"))
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("PENDING"))
      .andExpect(jsonPath("$.reason").isEmpty());
    mvc.perform(get("/api/bathrooms/" + bathroom.getId())).andExpect(status().isNotFound());
  }

  @Test
  void limitsRepeatedRequests() {
    String key = "test:" + UUID.randomUUID();
    abuse.check(key, 1, 300);
    assertThatThrownBy(() -> abuse.check(key, 1, 300)).isInstanceOf(br.com.khki.shared.api.ApiException.class);
  }

  @Test
  void preventsRoleEscalationAndBcryptTruncation() throws Exception {
    mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content("{\"name\":\"Teste\",\"email\":\"escalation@khki.test\",\"password\":\"Valid-password-123\",\"role\":\"ADMIN\"}")).andExpect(status().isBadRequest());
    mvc
      .perform(
        post("/api/auth/register")
          .with(csrf())
          .contentType("application/json")
          .content(json.writeValueAsString(java.util.Map.of("name", "Teste", "email", "bytes@khki.test", "password", "á".repeat(40))))
      )
      .andExpect(status().isBadRequest());
  }

  @Test
  void existingNonAuthorCannotReadPrivatePhotosOrReviseAnotherContribution() throws Exception {
    var admin = users.findByEmail("admin@khki.test").orElseThrow();
    var outsider = new User();
    outsider.setName("Outra pessoa");
    outsider.setEmail("outsider-" + UUID.randomUUID() + "@khki.test");
    outsider.setPassword("unused-test-hash");
    users.save(outsider);
    var bathroom = new Bathroom();
    bathroom.setAuthorId(admin.getId());
    bathroom.setName("Privado");
    bathroom.setAddress("Teste");
    bathroom.setCategory("Teste");
    bathroom.setAccess(AccessType.FREE);
    bathroom.setStatus(Status.REJECTED);
    bathrooms.save(bathroom);
    UUID photoId = UUID.randomUUID();
    bathroom.getImageUrls().add("/api/photos/" + photoId);
    bathrooms.save(bathroom);
    mvc.perform(get("/api/photos/" + photoId).with(user(outsider.getEmail()))).andExpect(status().isNotFound());
    mvc.perform(get("/api/me/contributions/BATHROOM/" + bathroom.getId()).with(user(outsider.getEmail()))).andExpect(status().isNotFound());
    mvc
      .perform(
        put("/api/bathrooms/" + bathroom.getId())
          .with(user(outsider.getEmail()))
          .with(csrf())
          .contentType("application/json")
          .content(bathroomInput("Tentativa indevida"))
      )
      .andExpect(status().isForbidden());
    mvc
      .perform(get("/api/admin/content/BATHROOM/" + bathroom.getId()).with(user(admin.getEmail()).roles("ADMIN")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.contribution.status").value("REJECTED"))
      .andExpect(jsonPath("$.content.name").value("Privado"));
  }

  private Bathroom moderationBathroom(String name, Status status, String complement, double latitude) {
    var author = users.findByEmail("admin@khki.test").orElseThrow();
    var bathroom = new Bathroom();
    bathroom.setAuthorId(author.getId());
    bathroom.setName(name);
    bathroom.setAddress("Rua das Flores, 123, Indaiatuba");
    bathroom.setComplement(complement);
    bathroom.setCategory("Shopping");
    bathroom.setAccess(AccessType.FREE);
    bathroom.setStatus(status);
    bathroom.setLatitude(latitude);
    bathroom.setLongitude(-47.218);
    return bathrooms.save(bathroom);
  }

  @Test
  void informationRequestStaysPrivateAndAuthorCanResubmitWithComplement() throws Exception {
    var bathroom = moderationBathroom("Informações " + UUID.randomUUID(), Status.PENDING, "Bloco B", -23.09);
    mvc
      .perform(get("/api/admin/queue/details").with(user("admin@khki.test").roles("ADMIN")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[?(@.contribution.id == '" + bathroom.getId() + "')].author").value("Administrador"));
    mvc
      .perform(
        post("/api/admin/content/BATHROOM/" + bathroom.getId() + "/decision")
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
          .contentType("application/json")
          .content("{\"status\":\"NEEDS_INFORMATION\",\"reason\":\"Informe o andar e o horário.\",\"expectedVersion\":0}")
      )
      .andExpect(status().isOk());
    mvc.perform(get("/api/bathrooms/" + bathroom.getId())).andExpect(status().isNotFound());
    mvc.perform(get("/api/me/contributions").with(user("admin@khki.test").roles("ADMIN"))).andExpect(jsonPath("$[?(@.id == '" + bathroom.getId() + "')].status").value("NEEDS_INFORMATION"));
    mvc
      .perform(
        put("/api/bathrooms/" + bathroom.getId())
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
          .contentType("application/json")
          .content(bathroomInput("Complementado").replace("\"items\":", "\"complement\":\"Piso L2, bloco B\",\"items\":"))
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("PENDING"));
    assertThat(bathrooms.findById(bathroom.getId()).orElseThrow().getComplement()).isEqualTo("Piso L2, bloco B");
    mvc
      .perform(get("/api/admin/content/BATHROOM/" + bathroom.getId() + "/history").with(user("admin@khki.test").roles("ADMIN")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].moderator").value("Administrador"))
      .andExpect(jsonPath("$[0].decision").value("NEEDS_INFORMATION"));
  }

  @Test
  void nearbyComparisonUsesSimilarityRadiusAndComplementWithoutAutoRejection() throws Exception {
    var pending = moderationBathroom("Shopping Árvore", Status.PENDING, "Piso L1", -24.1);
    var nearby = moderationBathroom("Shopping Arvore", Status.APPROVED, "Piso L2", -24.1002);
    var unrelated = moderationBathroom("Terminal rodoviário", Status.APPROVED, null, -24.1003);
    unrelated.setAddress("Avenida Central, 900, Salto");
    bathrooms.save(unrelated);
    var distant = moderationBathroom("Shopping Árvore", Status.APPROVED, "Piso L3", -24.105);
    mvc.perform(get("/api/admin/bathrooms/" + pending.getId() + "/nearby")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/admin/bathrooms/" + pending.getId() + "/nearby").with(user("common@khki.test"))).andExpect(status().isForbidden());
    mvc
      .perform(
        get("/api/admin/bathrooms/" + pending.getId() + "/nearby")
          .with(user("admin@khki.test").roles("ADMIN"))
          .param("radiusMeters", "1")
      )
      .andExpect(status().isBadRequest());
    mvc
      .perform(get("/api/admin/bathrooms/" + pending.getId() + "/nearby").with(user("admin@khki.test").roles("ADMIN")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.radiusMeters").value(150))
      .andExpect(jsonPath("$.candidates.length()").value(2))
      .andExpect(jsonPath("$.candidates[0].bathroom.id").value(nearby.getId().toString()))
      .andExpect(jsonPath("$.candidates[0].possibleDuplicate").value(true))
      .andExpect(jsonPath("$.candidates[0].differentComplement").value(true))
      .andExpect(jsonPath("$.candidates[1].possibleDuplicate").value(false));
    assertThat(bathrooms.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(Status.PENDING);
    mvc
      .perform(
        get("/api/admin/bathrooms/" + pending.getId() + "/nearby")
          .with(user("admin@khki.test").roles("ADMIN"))
          .param("radiusMeters", "1000")
      )
      .andExpect(jsonPath("$.candidates.length()").value(3));
    mvc
      .perform(
        post("/api/admin/content/BATHROOM/" + pending.getId() + "/decision")
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
          .contentType("application/json")
          .content("{\"status\":\"REJECTED\",\"reason\":\"Mesmo banheiro após conferência do andar.\",\"expectedVersion\":0,\"duplicateOfId\":\"" + nearby.getId() + "\"}")
      )
      .andExpect(status().isOk());
    mvc.perform(get("/api/admin/content/BATHROOM/" + pending.getId() + "/history").with(user("admin@khki.test").roles("ADMIN"))).andExpect(jsonPath("$[0].duplicateOfId").value(nearby.getId().toString()));
    assertThat(distant.getStatus()).isEqualTo(Status.APPROVED);
  }

  @Test
  void staleDecisionsAndDuplicateReportResolutionsReturnConflictAtomically() throws Exception {
    var bathroom = moderationBathroom("Concorrência " + UUID.randomUUID(), Status.PENDING, null, -25.1);
    mvc
      .perform(
        post("/api/admin/content/BATHROOM/" + bathroom.getId() + "/decision")
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
          .contentType("application/json")
          .content("{\"status\":\"APPROVED\",\"reason\":\"Conferido\",\"expectedVersion\":9}")
      )
      .andExpect(status().isConflict());
    assertThat(bathrooms.findById(bathroom.getId()).orElseThrow().getStatus()).isEqualTo(Status.PENDING);
    decide("BATHROOM", bathroom.getId(), "APPROVED");
    var report = new Report();
    report.setTargetType(TargetType.BATHROOM);
    report.setTargetId(bathroom.getId());
    report.setReason("INCORRECT");
    report.setReference(ContentReference.of(report.getTargetType(), report.getTargetId()));
    reports.save(report);
    String endpoint = "/api/admin/reports/" + report.getId() + "/resolve";
    mvc.perform(post(endpoint).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"reason\":\"Conferido\",\"status\":\"HIDDEN\",\"expectedVersion\":0,\"contentVersion\":0}")).andExpect(status().isConflict());
    assertThat(reports.findById(report.getId()).orElseThrow().getResolved()).isFalse();
    mvc.perform(post(endpoint).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"reason\":\"Informação incorreta confirmada.\",\"status\":\"HIDDEN\",\"expectedVersion\":0,\"contentVersion\":1}")).andExpect(status().isOk());
    assertThat(reports.findById(report.getId()).orElseThrow().getResolved()).isTrue();
    mvc
      .perform(get("/api/admin/reports/" + report.getId()).with(user("admin@khki.test").roles("ADMIN")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.resolved").value(true))
      .andExpect(jsonPath("$.version").value(1));
    mvc.perform(get("/api/bathrooms/" + bathroom.getId())).andExpect(status().isNotFound());
    mvc.perform(post(endpoint).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"reason\":\"Outra decisão\",\"expectedVersion\":0}")).andExpect(status().isConflict());
    mvc.perform(get("/api/admin/reports").with(user("admin@khki.test").roles("ADMIN")).param("resolved", "true")).andExpect(jsonPath("$[?(@.id == '" + report.getId() + "')].resolved").value(true));
  }

  @Test
  void authenticatedRegistrationPreviewOnlyReturnsPublishedNeighbors() throws Exception {
    var approved = moderationBathroom("Biblioteca Central", Status.APPROVED, "Térreo", -27.3);
    moderationBathroom("Biblioteca Central", Status.PENDING, "Piso L2", -27.3001);
    mvc.perform(get("/api/bathrooms/nearby").param("latitude", "-27.3").param("longitude", "-47.218")).andExpect(status().isUnauthorized());
    mvc
      .perform(get("/api/bathrooms/nearby").with(user("common@khki.test")).param("name", "Biblioteca Central").param("address", approved.getAddress()).param("complement", "Piso L2").param("latitude", "-27.3002").param("longitude", "-47.218"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.candidates.length()").value(1))
      .andExpect(jsonPath("$.candidates[0].bathroom.id").value(approved.getId().toString()))
      .andExpect(jsonPath("$.candidates[0].differentComplement").value(true));
  }

  @Test
  void structuredRegistrationPreservesIndependentChargeUnknownsAndModeration() throws Exception {
    var input = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(bathroomInput("Cadastro estruturado"));
    var details = input.putObject("details");
    details.put("audience", "CUSTOMERS").put("charge", "YES").put("feeAmount", 2.50).put("stepFreeAccess", true).put("grabBars", false).putNull("elevator").putNull("adaptedCabin").put("lastVisited", "2020-02-29");
    details.putArray("bathroomTypes").add("FEMALE").add("MALE");
    var result = mvc
      .perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(json.writeValueAsString(input)))
      .andExpect(status().isCreated())
      .andReturn();
    String id = body(result).get("id").asText();
    mvc.perform(get("/api/bathrooms/" + id)).andExpect(status().isNotFound());
    mvc
      .perform(get("/api/admin/content/BATHROOM/" + id).with(user("admin@khki.test").roles("ADMIN")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.content.details.audience").value("CUSTOMERS"))
      .andExpect(jsonPath("$.content.details.charge").value("YES"))
      .andExpect(jsonPath("$.content.details.grabBars").value(false))
      .andExpect(jsonPath("$.content.details.elevator").isEmpty());
    decide("BATHROOM", UUID.fromString(id), "APPROVED");
    mvc
      .perform(get("/api/bathrooms/" + id))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.access").value("CUSTOMERS"))
      .andExpect(jsonPath("$.details.charge").value("YES"))
      .andExpect(jsonPath("$.details.feeAmount").value(2.5))
      .andExpect(jsonPath("$.details.bathroomTypes.length()").value(2))
      .andExpect(jsonPath("$.details.lastVisited").value("2020-02-29"));
  }

  @Test
  void structuredRegistrationRejectsInvalidExternalValues() throws Exception {
    var input = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(bathroomInput("Validação dos novos campos"));
    String tomorrow = java.time.LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo")).plusDays(1).toString();
    for (String invalid : new String[] {
      "{\"audience\":\"ADMIN\"}",
      "{\"charge\":\"FREE\"}",
      "{\"charge\":\"NO\",\"feeAmount\":2}",
      "{\"charge\":\"YES\",\"feeAmount\":-1}",
      "{\"charge\":\"YES\",\"feeAmount\":1.001}",
      "{\"charge\":\"YES\",\"feeAmount\":1000000}",
      "{\"bathroomTypes\":[\"INVALID\"]}",
      "{\"bathroomTypes\":[null]}",
      "{\"lastVisited\":\"" + tomorrow + "\"}",
      "{\"lastVisited\":\"2025-02-31\"}"
    }) {
      input.set("details", json.readTree(invalid));
      mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isBadRequest());
    }
  }

  @Test
  void legacyRegistrationDoesNotInventNoChargeOrObservedAccessibility() throws Exception {
    var input = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(bathroomInput("Cadastro legado compatível"));
    input.put("access", "CUSTOMERS");
    var result = mvc
      .perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(json.writeValueAsString(input)))
      .andExpect(status().isCreated())
      .andReturn();
    String id = body(result).get("id").asText();
    mvc
      .perform(get("/api/me/contributions/BATHROOM/" + id).with(user("admin@khki.test").roles("ADMIN")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.details.audience").value("CUSTOMERS"))
      .andExpect(jsonPath("$.details.charge").value("UNKNOWN"))
      .andExpect(jsonPath("$.details.stepFreeAccess").isEmpty())
      .andExpect(jsonPath("$.details.bathroomTypes").isEmpty());
    var legacy = json.readValue(json.writeValueAsString(input), br.com.khki.shared.api.Contracts.BathroomInput.class);
    assertThat(json.readTree(json.writeValueAsString(legacy)).has("details")).isFalse();
  }

  private UUID attachmentUpload(UUID bathroomId, UUID reviewId, boolean registration) throws Exception {
    var image = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", image);
    var request = multipart("/api/bathrooms/" + bathroomId + "/photos")
      .file(new MockMultipartFile("file", "foto.png", "image/png", image.toByteArray()))
      .param("registrationAttachment", Boolean.toString(registration))
      .with(user("admin@khki.test").roles("ADMIN"))
      .with(csrf());
    if (reviewId != null) request.param("reviewId", reviewId.toString());
    mvc.perform(request).andExpect(status().isCreated());
    return imageId(reviewId == null ? "bathrooms" : "reviews", reviewId == null ? bathroomId : reviewId);
  }

  private UUID pendingReview(UUID bathroomId) throws Exception {
    return UUID.fromString(
      body(
        mvc
          .perform(
            post("/api/bathrooms/" + bathroomId + "/reviews")
              .with(user("admin@khki.test").roles("ADMIN"))
              .with(csrf())
              .contentType("application/json")
              .content("{\"cleanliness\":3,\"structure\":4,\"comment\":\"Com foto anexada\"}")
          )
          .andExpect(status().isCreated())
          .andReturn()
      )
        .get("id")
        .asText()
    );
  }

  @Test
  void newAttachmentInvalidatesParentVersionAndCannotBeAddedAfterApproval() throws Exception {
    UUID bathroomId = UUID.fromString(
      body(
        mvc
          .perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Versão dos anexos")))
          .andExpect(status().isCreated())
          .andReturn()
      )
        .get("id")
        .asText()
    );
    long before = bathrooms.findById(bathroomId).orElseThrow().getVersion();
    UUID photo = attachmentUpload(bathroomId, null, true);
    assertThat(bathrooms.findById(bathroomId).orElseThrow().getVersion()).isGreaterThan(before);
    mvc
      .perform(
        post("/api/admin/content/BATHROOM/" + bathroomId + "/decision")
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
          .contentType("application/json")
          .content("{\"status\":\"APPROVED\",\"reason\":\"Análise antiga\",\"expectedVersion\":" + before + "}")
      )
      .andExpect(status().isConflict());
    mvc.perform(get("/api/photos/" + photo)).andExpect(status().isNotFound());
    assertThat(audits.findByTargetTypeAndTargetIdOrderByCreatedAtDesc(TargetType.BATHROOM, bathroomId)).isEmpty();
    decide("BATHROOM", bathroomId, "APPROVED");
    var image = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", image);
    mvc
      .perform(
        multipart("/api/bathrooms/" + bathroomId + "/photos")
          .file(new MockMultipartFile("file", "foto.png", "image/png", image.toByteArray()))
          .param("registrationAttachment", "true")
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
      )
      .andExpect(status().isConflict());
    UUID review = pendingReview(bathroomId);
    long oldReviewVersion = reviews.findById(review).orElseThrow().getVersion();
    attachmentUpload(bathroomId, review, false);
    assertThat(reviews.findById(review).orElseThrow().getVersion()).isGreaterThan(oldReviewVersion);
    mvc
      .perform(
        multipart("/api/bathrooms/" + bathroomId + "/photos")
          .file(new MockMultipartFile("file", "foto.png", "image/png", image.toByteArray()))
          .param("registrationAttachment", "true")
          .param("reviewId", review.toString())
          .with(user("admin@khki.test").roles("ADMIN"))
          .with(csrf())
      )
      .andExpect(status().isBadRequest());
  }

  private UUID imageId(String table, UUID id) throws Exception {
    if (!java.util.Set.of("bathrooms", "reviews").contains(table)) throw new IllegalArgumentException();
    var urls = json.readTree(jdbc.queryForObject("SELECT image_urls::text FROM " + table + " WHERE id = ?", String.class, id));
    return UUID.fromString(urls.get(urls.size() - 1).asText().substring("/api/photos/".length()));
  }

  @Test
  void imagesAreOnlyAttachmentsAndModerationAlwaysTargetsTheirParent() throws Exception {
    var bathroom = moderationBathroom("Fotos no cadastro", Status.PENDING, null, -26.9);
    UUID photo = attachmentUpload(bathroom.getId(), null, true);
    mvc.perform(get("/api/photos/" + photo)).andExpect(status().isNotFound());
    mvc.perform(post("/api/reports").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"targetType\":\"PHOTO\",\"targetId\":\"" + photo + "\",\"reason\":\"PRIVACY\"}")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/admin/content/PHOTO/" + photo).with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isBadRequest());
    decide("BATHROOM", bathroom.getId(), "APPROVED");
    mvc.perform(get("/api/photos/" + photo)).andExpect(status().isOk());
    UUID review = pendingReview(bathroom.getId());
    UUID reviewPhoto = attachmentUpload(bathroom.getId(), review, false);
    mvc.perform(get("/api/photos/" + reviewPhoto)).andExpect(status().isNotFound());
    decide("REVIEW", review, "APPROVED");
    mvc.perform(get("/api/photos/" + reviewPhoto)).andExpect(status().isOk());
    decide("REVIEW", review, "HIDDEN");
    mvc.perform(get("/api/photos/" + reviewPhoto)).andExpect(status().isNotFound());
    mvc.perform(get("/api/photos/" + photo)).andExpect(status().isOk());
    assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_name IN ('bathroom_images','review_images','photos')", Integer.class)).isZero();
  }

  @Test
  void rejectsStandaloneUploadsEvenForTheBathroomAuthor() throws Exception {
    var bathroom = moderationBathroom("Sem envio avulso", Status.APPROVED, null, -26.9);
    var bytes = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", bytes);
    long count = reviews.count();
    mvc.perform(multipart("/api/bathrooms/" + bathroom.getId() + "/photos").file(new MockMultipartFile("file", "foto.png", "image/png", bytes.toByteArray())).with(user("admin@khki.test").roles("ADMIN")).with(csrf())).andExpect(status().isBadRequest());
    assertThat(reviews.count()).isEqualTo(count);
    assertThat(bathrooms.findById(bathroom.getId()).orElseThrow().getImageUrls()).isEmpty();
  }

  @Test
  void userTableAndContributionsWorkWithoutSubmissionReceipts() throws Exception {
    assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_name = 'submission_receipts'", Integer.class)).isZero();
    assertThat(jdbc.queryForObject("SELECT count(*) FROM \"user\"", Integer.class)).isPositive();
    var result = mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Cadastro sem recibo"))).andExpect(status().isCreated()).andReturn();
    UUID id = UUID.fromString(body(result).get("id").asText());
    assertThat(bathrooms.findById(id).orElseThrow().getAuthorId()).isEqualTo(users.findByEmail("admin@khki.test").orElseThrow().getId());
    mvc.perform(get("/api/me/submissions/" + UUID.randomUUID()).with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isNotFound());
    mvc.perform(get("/api/me/contributions/BATHROOM/" + id).with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isOk());
  }
}
