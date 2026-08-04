package com.company.autoplatform.settings;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Component
public class MockExecutionCredentialService {

    public static final String HEADER = "X-Mock-Execution-Token";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final byte[] secret;
    private final long ttlSeconds;

    public MockExecutionCredentialService(
            @Value("${autoplatform.mock.execution-secret:change-me-in-production}") String secret,
            @Value("${autoplatform.mock.execution-token-ttl-seconds:86400}") long ttlSeconds
    ) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = Math.max(60, ttlSeconds);
    }

    public String issue(String workspaceCode, String appCode, Long releaseId) {
        long issuedAt = Instant.now().getEpochSecond();
        String payload = normalize(workspaceCode) + "\n"
                + normalize(appCode) + "\n"
                + (releaseId == null ? "" : releaseId) + "\n"
                + issuedAt;
        return ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8))
                + "."
                + ENCODER.encodeToString(sign(payload));
    }

    public Optional<Credential> validate(String token, String workspaceCode, String appCode) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            String[] parts = token.trim().split("\\.", -1);
            if (parts.length != 2) {
                return Optional.empty();
            }
            String payload = new String(DECODER.decode(parts[0]), StandardCharsets.UTF_8);
            byte[] signature = DECODER.decode(parts[1]);
            if (!MessageDigest.isEqual(sign(payload), signature)) {
                return Optional.empty();
            }
            String[] fields = payload.split("\\n", -1);
            if (fields.length != 4
                    || !fields[0].equals(normalize(workspaceCode))
                    || !fields[1].equals(normalize(appCode))) {
                return Optional.empty();
            }
            long issuedAt = Long.parseLong(fields[3]);
            long now = Instant.now().getEpochSecond();
            if (issuedAt > now + 60 || now - issuedAt > ttlSeconds) {
                return Optional.empty();
            }
            Long releaseId = fields[2].isBlank() ? null : Long.valueOf(fields[2]);
            return Optional.of(new Credential(fields[0], fields[1], releaseId, issuedAt));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot create Mock execution credential", exception);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    public record Credential(String workspaceCode, String appCode, Long releaseId, long issuedAt) {
    }
}
