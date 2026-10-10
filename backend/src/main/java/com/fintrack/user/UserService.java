package com.fintrack.user;

import com.fintrack.auth.dto.UserDto;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.common.exception.UnauthorizedException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager em;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public UserDto getMe(UUID userId) {
        return toDto(findUser(userId));
    }

    @Transactional
    public UserDto updateMe(UUID userId, UpdateMeRequest req) {
        UserEntity user = findUser(userId);
        if (req.phone() != null) user.setPhone(req.phone());
        if (req.timezone() != null) user.setTimezone(req.timezone());
        if (req.baseCurrencyCode() != null) user.setBaseCurrencyCode(req.baseCurrencyCode());
        return toDto(user);
    }

    @Transactional
    public void deleteMe(UUID userId, DeleteAccountRequest req) {
        UserEntity user = findUser(userId);

        String normalizedEmail = req.email().trim().toLowerCase();
        if (!normalizedEmail.equals(user.getEmail())
                || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        // Explicit deletion order to respect FK RESTRICT constraints:
        // transactions and recurring_rules reference categories (RESTRICT), so they go first.
        em.createQuery("DELETE FROM TransactionEntity t WHERE t.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM RecurringRuleEntity r WHERE r.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM CategoryEntity c WHERE c.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM NetWorthSnapshotEntity s WHERE s.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM AssetCategoryEntity a WHERE a.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM RefreshTokenEntity rt WHERE rt.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM com.fintrack.auth.PasswordResetTokenEntity p WHERE p.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM com.fintrack.currency.ExchangeRateEntity x WHERE x.userId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM com.fintrack.household.HouseholdMemberEntity hm "
                        + "WHERE hm.ownerUserId = :uid OR hm.memberUserId = :uid")
                .setParameter("uid", userId).executeUpdate();
        em.createQuery("DELETE FROM com.fintrack.household.HouseholdInviteEntity hi WHERE hi.ownerUserId = :uid")
                .setParameter("uid", userId).executeUpdate();

        users.delete(user);
    }

    private UserEntity findUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private UserDto toDto(UserEntity u) {
        return new UserDto(u.getId(), u.getEmail(), u.getPhone(), u.getTimezone(), u.getBaseCurrencyCode());
    }
}
