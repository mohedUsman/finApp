package com.fintrack.networth;

import com.fintrack.common.exception.ConflictException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.networth.dto.CreateSnapshotRequest;
import com.fintrack.networth.dto.NetWorthSnapshotDto;
import com.fintrack.networth.dto.UpdateSnapshotRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NetWorthService {

    private final NetWorthSnapshotRepository snapshots;

    public NetWorthService(NetWorthSnapshotRepository snapshots) {
        this.snapshots = snapshots;
    }

    public List<NetWorthSnapshotDto> list(UUID userId) {
        return snapshots.findByUserIdOrderBySnapshotDateDesc(userId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public NetWorthSnapshotDto create(UUID userId, CreateSnapshotRequest req) {
        if (snapshots.existsByUserIdAndSnapshotDate(userId, req.snapshotDate())) {
            throw new ConflictException("DUPLICATE_DATE", "A snapshot for this date already exists");
        }
        NetWorthSnapshotEntity s = new NetWorthSnapshotEntity();
        s.setId(UUID.randomUUID());
        s.setUserId(userId);
        s.setSnapshotDate(req.snapshotDate());
        s.setBalances(req.balances());
        s.setNote(req.note());
        snapshots.save(s);
        return toDto(s);
    }

    @Transactional
    public NetWorthSnapshotDto update(UUID id, UUID userId, UpdateSnapshotRequest req) {
        NetWorthSnapshotEntity s = findOwned(id, userId);
        if (req.snapshotDate() != null) {
            if (snapshots.existsByUserIdAndSnapshotDateAndIdNot(userId, req.snapshotDate(), id)) {
                throw new ConflictException("DUPLICATE_DATE", "A snapshot for this date already exists");
            }
            s.setSnapshotDate(req.snapshotDate());
        }
        if (req.balances() != null) s.setBalances(req.balances());
        if (req.note() != null) s.setNote(req.note());
        return toDto(s);
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        snapshots.delete(findOwned(id, userId));
    }

    private NetWorthSnapshotEntity findOwned(UUID id, UUID userId) {
        return snapshots.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Snapshot not found"));
    }

    private NetWorthSnapshotDto toDto(NetWorthSnapshotEntity s) {
        return new NetWorthSnapshotDto(s.getId(), s.getSnapshotDate(), s.getBalances(),
                s.getNote(), s.getCreatedAt(), s.getUpdatedAt());
    }
}
