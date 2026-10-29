package br.com.khki;

import br.com.khki.domain.*;
import br.com.khki.repository.*;
import br.com.khki.security.AbuseGuard;
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
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:workflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE}", "spring.datasource.username=${TEST_DATABASE_USER:sa}", "spring.datasource.password=${TEST_DATABASE_PASSWORD:}", "khki.admin-email=admin@khki.test", "khki.admin-password=Test-admin-password-123", "khki.demo=false"})
@AutoConfigureMockMvc
class WorkflowTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired BathroomRepository bathrooms;
    @Autowired ReviewRepository reviews;
    @Autowired PhotoRepository photos;
    @Autowired AppUserRepository users;
    @Autowired ModerationAuditRepository audits;
    @Autowired ReportRepository reports;
    @Autowired AbuseGuard abuse;
    private JsonNode body(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()); }
    private String bathroomInput(String name) { return "{\"name\":\"" + name + "\",\"address\":\"Rua de teste, 100, São Paulo\",\"category\":\"Café\",\"latitude\":-23.55,\"longitude\":-46.65,\"access\":\"FREE\",\"accessible\":true,\"items\":[\"SOAP\",\"SINK\"]}"; }
    private MockHttpSession login(String email, String password) throws Exception { return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content(json.writeValueAsString(java.util.Map.of("email", email, "password", password)))).andExpect(status().isOk()).andReturn().getRequest().getSession(); }
    private void decide(String type, UUID id, String status) throws Exception { mvc.perform(post("/api/admin/content/" + type + "/" + id + "/decision").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"status\":\"" + status + "\",\"reason\":\"Análise humana registrada\"}")).andExpect(status().isOk()); }
    @Test void completeModeratedWorkflowAndPrivacy() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@khki.test";
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content(json.writeValueAsString(java.util.Map.of("name", "Pessoa de teste", "email", email, "password", "Test-user-password-123")))).andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("USER")).andExpect(jsonPath("$.password").doesNotExist());
        var session = login(email, "Test-user-password-123");
        UUID bathroomId = UUID.fromString(body(mvc.perform(post("/api/bathrooms").session(session).with(csrf()).contentType("application/json").content(bathroomInput("Banheiro de teste"))).andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING")).andReturn()).get("id").asText());
        mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/bathrooms").param("q", "Banheiro de teste")).andExpect(content().json("[]"));
        mvc.perform(get("/api/admin/queue")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/queue").session(session)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/content/BATHROOM/" + bathroomId + "/decision").session(session).with(csrf()).contentType("application/json").content("{\"status\":\"APPROVED\",\"reason\":\"Tentativa indevida\"}")).andExpect(status().isForbidden());
        var image = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", image);
        var upload = new MockMultipartFile("file", "banheiro.png", "image/png", image.toByteArray());
        UUID photoId = UUID.fromString(body(mvc.perform(multipart("/api/bathrooms/" + bathroomId + "/photos").file(upload).session(session).with(csrf())).andExpect(status().isCreated()).andReturn()).get("id").asText());
        mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/photos/" + photoId).session(session)).andExpect(status().isOk()).andExpect(content().contentType("image/jpeg"));
        mvc.perform(get("/api/photos/" + photoId).with(user("other@khki.test"))).andExpect(status().isNotFound());
        decide("BATHROOM", bathroomId, "APPROVED");
        mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(status().isOk()).andExpect(jsonPath("$.photoIds.length()").value(0)).andExpect(jsonPath("$.rating").isEmpty());
        decide("PHOTO", photoId, "APPROVED");
        mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isOk());
        UUID reviewId = UUID.fromString(body(mvc.perform(post("/api/bathrooms/" + bathroomId + "/reviews").session(session).with(csrf()).contentType("application/json").content("{\"cleanliness\":1,\"structure\":2,\"comment\":\"Experiência negativa, precisa melhorar.\"}")).andExpect(status().isCreated()).andReturn()).get("id").asText());
        mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(jsonPath("$.reviewCount").value(0));
        decide("REVIEW", reviewId, "APPROVED");
        mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(jsonPath("$.reviewCount").value(1)).andExpect(jsonPath("$.rating").value(1.5));
        decide("REVIEW", reviewId, "HIDDEN");
        mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(jsonPath("$.reviewCount").value(0)).andExpect(jsonPath("$.rating").isEmpty());
        decide("REVIEW", reviewId, "APPROVED");
        mvc.perform(post("/api/reports").with(csrf()).contentType("application/json").content("{\"targetType\":\"BATHROOM\",\"targetId\":\"" + bathroomId + "\",\"reason\":\"INCORRECT\"}")).andExpect(status().isAccepted());
        mvc.perform(post("/api/reports").with(csrf()).contentType("application/json").content("{\"targetType\":\"BATHROOM\",\"targetId\":\"" + bathroomId + "\",\"reason\":\"INCORRECT\"}")).andExpect(status().isTooManyRequests());
        decide("BATHROOM", bathroomId, "HIDDEN");
        mvc.perform(get("/api/bathrooms/" + bathroomId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/bathrooms/" + bathroomId + "/reviews")).andExpect(status().isNotFound());
        decide("BATHROOM", bathroomId, "APPROVED");
        decide("PHOTO", photoId, "REMOVED");
        assertThat(photos.findById(photoId).orElseThrow().data).isEmpty();
        assertThat(audits.count()).isGreaterThanOrEqualTo(6);
        mvc.perform(get("/api/me/contributions").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
    }
    @Test void rejectsInvalidInputsAndRequiresCsrf() throws Exception {
        mvc.perform(post("/api/auth/register").contentType("application/json").content("{}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content("{\"name\":\"Teste\",\"email\":\"invalid\",\"password\":\"123\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Inválido").replace("-23.55", "999"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Inválido").replace("SOAP", "<script>"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\"admin@khki.test\",\"password\":\"incorrect\"}")).andExpect(status().isUnauthorized());
    }
    @Test void rejectsDisguisedUploads() throws Exception {
        var admin = users.findByEmail("admin@khki.test").orElseThrow(); var bathroom = new Bathroom(); bathroom.authorId = admin.id; bathroom.name = "Upload"; bathroom.address = "Teste"; bathroom.category = "Teste"; bathroom.access = Access.FREE; bathroom.status = Status.APPROVED; bathrooms.save(bathroom);
        mvc.perform(multipart("/api/bathrooms/" + bathroom.id + "/photos").file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", "<script>alert(1)</script>".getBytes())).with(user(admin.email).roles("ADMIN")).with(csrf())).andExpect(status().isBadRequest());
    }
    @Test void rejectedContributionCanOnlyBeResubmittedByAuthor() throws Exception {
        var admin = users.findByEmail("admin@khki.test").orElseThrow(); var bathroom = new Bathroom(); bathroom.authorId = admin.id; bathroom.name = "Rejeitado"; bathroom.address = "Teste"; bathroom.category = "Teste"; bathroom.access = Access.FREE; bathroom.status = Status.REJECTED; bathroom.reason = "Corrigir endereço"; bathrooms.save(bathroom);
        mvc.perform(put("/api/bathrooms/" + bathroom.id).with(user(admin.email).roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Corrigido"))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.reason").isEmpty());
        mvc.perform(get("/api/bathrooms/" + bathroom.id)).andExpect(status().isNotFound());
    }
    @Test void limitsRepeatedRequests() { String key = "test:" + UUID.randomUUID(); abuse.check(key, 1, 300); assertThatThrownBy(() -> abuse.check(key, 1, 300)).isInstanceOf(br.com.khki.api.ApiException.class); }
    @Test void preventsRoleEscalationAndBcryptTruncation() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content("{\"name\":\"Teste\",\"email\":\"escalation@khki.test\",\"password\":\"Valid-password-123\",\"role\":\"ADMIN\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content(json.writeValueAsString(java.util.Map.of("name", "Teste", "email", "bytes@khki.test", "password", "á".repeat(40))))).andExpect(status().isBadRequest());
    }
    @Test void existingNonAuthorCannotReadPrivatePhotosOrReviseAnotherContribution() throws Exception {
        var admin = users.findByEmail("admin@khki.test").orElseThrow();
        var outsider = new AppUser(); outsider.name = "Outra pessoa"; outsider.email = "outsider-" + UUID.randomUUID() + "@khki.test"; outsider.password = "unused-test-hash"; users.save(outsider);
        var bathroom = new Bathroom(); bathroom.authorId = admin.id; bathroom.name = "Privado"; bathroom.address = "Teste"; bathroom.category = "Teste"; bathroom.access = Access.FREE; bathroom.status = Status.REJECTED; bathrooms.save(bathroom);
        var photo = new Photo(); photo.authorId = admin.id; photo.bathroomId = bathroom.id; photo.data = new byte[] {1}; photos.save(photo);
        mvc.perform(get("/api/photos/" + photo.id).with(user(outsider.email))).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/contributions/BATHROOM/" + bathroom.id).with(user(outsider.email))).andExpect(status().isNotFound());
        mvc.perform(put("/api/bathrooms/" + bathroom.id).with(user(outsider.email)).with(csrf()).contentType("application/json").content(bathroomInput("Tentativa indevida"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/content/BATHROOM/" + bathroom.id).with(user(admin.email).roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.contribution.status").value("REJECTED")).andExpect(jsonPath("$.content.name").value("Privado"));
    }
    private Bathroom moderationBathroom(String name, Status status, String complement, double latitude) {
        var author = users.findByEmail("admin@khki.test").orElseThrow(); var bathroom = new Bathroom(); bathroom.authorId = author.id; bathroom.name = name; bathroom.address = "Rua das Flores, 123, Indaiatuba"; bathroom.complement = complement; bathroom.category = "Shopping"; bathroom.access = Access.FREE; bathroom.status = status; bathroom.latitude = latitude; bathroom.longitude = -47.218; return bathrooms.save(bathroom);
    }
    @Test void informationRequestStaysPrivateAndAuthorCanResubmitWithComplement() throws Exception {
        var bathroom = moderationBathroom("Informações " + UUID.randomUUID(), Status.PENDING, "Bloco B", -23.09);
        mvc.perform(get("/api/admin/queue/details").with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.contribution.id == '" + bathroom.id + "')].author").value("Administrador"));
        mvc.perform(post("/api/admin/content/BATHROOM/" + bathroom.id + "/decision").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"status\":\"NEEDS_INFORMATION\",\"reason\":\"Informe o andar e o horário.\",\"expectedVersion\":0}")).andExpect(status().isOk());
        mvc.perform(get("/api/bathrooms/" + bathroom.id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/contributions").with(user("admin@khki.test").roles("ADMIN"))).andExpect(jsonPath("$[?(@.id == '" + bathroom.id + "')].status").value("NEEDS_INFORMATION"));
        mvc.perform(put("/api/bathrooms/" + bathroom.id).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(bathroomInput("Complementado").replace("\"items\":", "\"complement\":\"Piso L2, bloco B\",\"items\":"))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));
        assertThat(bathrooms.findById(bathroom.id).orElseThrow().complement).isEqualTo("Piso L2, bloco B");
        mvc.perform(get("/api/admin/content/BATHROOM/" + bathroom.id + "/history").with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].moderator").value("Administrador")).andExpect(jsonPath("$[0].decision").value("NEEDS_INFORMATION"));
    }
    @Test void nearbyComparisonUsesSimilarityRadiusAndComplementWithoutAutoRejection() throws Exception {
        var pending = moderationBathroom("Shopping Árvore", Status.PENDING, "Piso L1", -24.1);
        var nearby = moderationBathroom("Shopping Arvore", Status.APPROVED, "Piso L2", -24.1002);
        var unrelated = moderationBathroom("Terminal rodoviário", Status.APPROVED, null, -24.1003); unrelated.address = "Avenida Central, 900, Salto"; bathrooms.save(unrelated);
        var distant = moderationBathroom("Shopping Árvore", Status.APPROVED, "Piso L3", -24.105);
        mvc.perform(get("/api/admin/bathrooms/" + pending.id + "/nearby")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/bathrooms/" + pending.id + "/nearby").with(user("common@khki.test"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/bathrooms/" + pending.id + "/nearby").with(user("admin@khki.test").roles("ADMIN")).param("radiusMeters", "1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/bathrooms/" + pending.id + "/nearby").with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.radiusMeters").value(150)).andExpect(jsonPath("$.candidates.length()").value(2)).andExpect(jsonPath("$.candidates[0].bathroom.id").value(nearby.id.toString())).andExpect(jsonPath("$.candidates[0].possibleDuplicate").value(true)).andExpect(jsonPath("$.candidates[0].differentComplement").value(true)).andExpect(jsonPath("$.candidates[1].possibleDuplicate").value(false));
        assertThat(bathrooms.findById(pending.id).orElseThrow().status).isEqualTo(Status.PENDING);
        mvc.perform(get("/api/admin/bathrooms/" + pending.id + "/nearby").with(user("admin@khki.test").roles("ADMIN")).param("radiusMeters", "1000")).andExpect(jsonPath("$.candidates.length()").value(3));
        mvc.perform(post("/api/admin/content/BATHROOM/" + pending.id + "/decision").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"status\":\"REJECTED\",\"reason\":\"Mesmo banheiro após conferência do andar.\",\"expectedVersion\":0,\"duplicateOfId\":\"" + nearby.id + "\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/content/BATHROOM/" + pending.id + "/history").with(user("admin@khki.test").roles("ADMIN"))).andExpect(jsonPath("$[0].duplicateOfId").value(nearby.id.toString()));
        assertThat(distant.status).isEqualTo(Status.APPROVED);
    }
    @Test void staleDecisionsAndDuplicateReportResolutionsReturnConflictAtomically() throws Exception {
        var bathroom = moderationBathroom("Concorrência " + UUID.randomUUID(), Status.PENDING, null, -25.1);
        mvc.perform(post("/api/admin/content/BATHROOM/" + bathroom.id + "/decision").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"status\":\"APPROVED\",\"reason\":\"Conferido\",\"expectedVersion\":9}")).andExpect(status().isConflict());
        assertThat(bathrooms.findById(bathroom.id).orElseThrow().status).isEqualTo(Status.PENDING);
        decide("BATHROOM", bathroom.id, "APPROVED");
        var report = new Report(); report.targetType = TargetType.BATHROOM; report.targetId = bathroom.id; report.reason = "INCORRECT"; reports.save(report);
        String endpoint = "/api/admin/reports/" + report.id + "/resolve";
        mvc.perform(post(endpoint).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"reason\":\"Conferido\",\"status\":\"HIDDEN\",\"expectedVersion\":0,\"contentVersion\":0}")).andExpect(status().isConflict());
        assertThat(reports.findById(report.id).orElseThrow().resolved).isFalse();
        mvc.perform(post(endpoint).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"reason\":\"Informação incorreta confirmada.\",\"status\":\"HIDDEN\",\"expectedVersion\":0,\"contentVersion\":1}")).andExpect(status().isOk());
        assertThat(reports.findById(report.id).orElseThrow().resolved).isTrue();
        mvc.perform(get("/api/admin/reports/" + report.id).with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.resolved").value(true)).andExpect(jsonPath("$.version").value(1));
        mvc.perform(get("/api/bathrooms/" + bathroom.id)).andExpect(status().isNotFound());
        mvc.perform(post(endpoint).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"reason\":\"Outra decisão\",\"expectedVersion\":0}")).andExpect(status().isConflict());
        mvc.perform(get("/api/admin/reports").with(user("admin@khki.test").roles("ADMIN")).param("resolved", "true")).andExpect(jsonPath("$[?(@.id == '" + report.id + "')].resolved").value(true));
    }
    @Test void registrationRetriesReuseReceiptWithoutDuplicatingOrLeakingOtherAuthors() throws Exception {
        UUID key = UUID.randomUUID(); String name = "Tentativa " + key;
        String input = bathroomInput(name).replace("\"items\":", "\"submissionId\":\"" + key + "\",\"items\":");
        UUID id = UUID.fromString(body(mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(input)).andExpect(status().isCreated()).andReturn()).get("id").asText());
        mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(input)).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id.toString()));
        assertThat(bathrooms.findByAuthorIdOrderByCreatedAtDesc(users.findByEmail("admin@khki.test").orElseThrow().id).stream().filter(value -> value.name.equals(name)).count()).isEqualTo(1);
        mvc.perform(get("/api/bathrooms/" + id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/submissions/" + key).with(user("admin@khki.test").roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id.toString())).andExpect(jsonPath("$.fingerprint").doesNotExist());
        mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(input.replace(name, "Dados diferentes"))).andExpect(status().isConflict());
        var outsider = new AppUser(); outsider.name = "Outro autor"; outsider.email = "receipt-" + key + "@khki.test"; outsider.password = "unused-test-hash"; users.save(outsider);
        mvc.perform(get("/api/me/submissions/" + key).with(user(outsider.email))).andExpect(status().isNotFound());
        mvc.perform(post("/api/bathrooms").with(user(outsider.email)).with(csrf()).contentType("application/json").content(input)).andExpect(status().isConflict());
        decide("BATHROOM", id, "REJECTED"); String correction = input.replace(key.toString(), UUID.randomUUID().toString()).replace(name, "Corrigido " + key);
        for (int attempt = 0; attempt < 2; attempt++) mvc.perform(put("/api/bathrooms/" + id).with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(correction)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id.toString())).andExpect(jsonPath("$.status").value("PENDING"));
    }
    @Test void photoRetriesAreIdempotentAndStayPrivate() throws Exception {
        var bathroom = moderationBathroom("Reenvio de foto", Status.PENDING, null, -26.2); UUID key = UUID.randomUUID(); var image = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", image);
        var upload = new MockMultipartFile("file", "banheiro.png", "image/png", image.toByteArray());
        UUID photoId = UUID.fromString(body(mvc.perform(multipart("/api/bathrooms/" + bathroom.id + "/photos").file(upload).param("submissionId", key.toString()).with(user("admin@khki.test").roles("ADMIN")).with(csrf())).andExpect(status().isCreated()).andReturn()).get("id").asText());
        mvc.perform(multipart("/api/bathrooms/" + bathroom.id + "/photos").file(upload).param("submissionId", key.toString()).with(user("admin@khki.test").roles("ADMIN")).with(csrf())).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(photoId.toString()));
        assertThat(photos.findByBathroomIdAndStatus(bathroom.id, Status.PENDING)).hasSize(1);
        mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isNotFound());
        mvc.perform(multipart("/api/bathrooms/" + bathroom.id + "/photos").file(upload).param("submissionId", "invalid").with(user("admin@khki.test").roles("ADMIN")).with(csrf())).andExpect(status().isBadRequest());
    }
    @Test void authenticatedRegistrationPreviewOnlyReturnsPublishedNeighbors() throws Exception {
        var approved = moderationBathroom("Biblioteca Central", Status.APPROVED, "Térreo", -27.3); moderationBathroom("Biblioteca Central", Status.PENDING, "Piso L2", -27.3001);
        mvc.perform(get("/api/bathrooms/nearby").param("latitude", "-27.3").param("longitude", "-47.218")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/bathrooms/nearby").with(user("common@khki.test")).param("name", "Biblioteca Central").param("address", approved.address).param("complement", "Piso L2").param("latitude", "-27.3002").param("longitude", "-47.218")).andExpect(status().isOk()).andExpect(jsonPath("$.candidates.length()").value(1)).andExpect(jsonPath("$.candidates[0].bathroom.id").value(approved.id.toString())).andExpect(jsonPath("$.candidates[0].differentComplement").value(true));
    }
    @Test void concurrentIdenticalSubmissionCreatesExactlyOneRecord() throws Exception {
        UUID key = UUID.randomUUID(); String name = "Concorrência de envio " + key; String input = bathroomInput(name).replace("\"items\":", "\"submissionId\":\"" + key + "\",\"items\":"); var start = new java.util.concurrent.CountDownLatch(1); var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Callable<Integer> request = () -> { start.await(); return mvc.perform(post("/api/bathrooms").with(user("admin@khki.test").roles("ADMIN")).with(csrf()).contentType("application/json").content(input)).andReturn().getResponse().getStatus(); };
            var first = pool.submit(request); var second = pool.submit(request); start.countDown(); var statuses = java.util.List.of(first.get(), second.get()); assertThat(statuses).allMatch(value -> value == 201 || value == 409); assertThat(statuses).contains(201);
            assertThat(bathrooms.findByAuthorIdOrderByCreatedAtDesc(users.findByEmail("admin@khki.test").orElseThrow().id).stream().filter(value -> value.name.equals(name)).count()).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
}