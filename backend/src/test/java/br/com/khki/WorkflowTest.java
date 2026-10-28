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
}
