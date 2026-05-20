package com.fintrack.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.nio.ByteBuffer;
import java.util.UUID;

@Converter(autoApply = false)
public class UuidBinaryConverter implements AttributeConverter<UUID, byte[]> {

    @Override
    public byte[] convertToDatabaseColumn(UUID attribute) {
        if (attribute == null) return null;
        ByteBuffer buffer = ByteBuffer.allocate(16);
        buffer.putLong(attribute.getMostSignificantBits());
        buffer.putLong(attribute.getLeastSignificantBits());
        return buffer.array();
    }

    @Override
    public UUID convertToEntityAttribute(byte[] data) {
        if (data == null || data.length != 16) return null;
        ByteBuffer buffer = ByteBuffer.wrap(data);
        long msb = buffer.getLong();
        long lsb = buffer.getLong();
        return new UUID(msb, lsb);
    }
}
