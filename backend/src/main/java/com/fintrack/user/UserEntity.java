package com.fintrack.user;

import com.fintrack.common.BaseEntity;
import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity extends BaseEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "email", nullable = false, length = 254, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 72)
    private String passwordHash;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "Asia/Kolkata";

    @Column(name = "base_currency_code", columnDefinition = "CHAR(3)", nullable = false)
    private String baseCurrencyCode = "INR";

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getBaseCurrencyCode() { return baseCurrencyCode; }
    public void setBaseCurrencyCode(String baseCurrencyCode) { this.baseCurrencyCode = baseCurrencyCode; }
}
