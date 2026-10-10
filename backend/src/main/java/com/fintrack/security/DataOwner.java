package com.fintrack.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The user whose data the request operates on. Identical to {@link CurrentUser}
 * unless the caller has joined someone else's household, in which case it
 * resolves to that household's owner. Domain endpoints use this; endpoints
 * acting on the caller's own account use {@link CurrentUser}.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface DataOwner {}
