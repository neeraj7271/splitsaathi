import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialLogicalModel1783641600000 implements MigrationInterface {
  name = 'InitialLogicalModel1783641600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE currencies (
        code CHAR(3) PRIMARY KEY CHECK (char_length(code) = 3),
        minor_unit INTEGER NOT NULL CHECK (minor_unit >= 0),
        symbol TEXT NOT NULL,
        display_locale TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE
      );

      INSERT INTO currencies (code, minor_unit, symbol, display_locale, enabled)
      VALUES
        ('INR', 2, 'INR', 'en-IN', TRUE),
        ('USD', 2, '$', 'en-US', TRUE),
        ('EUR', 2, 'EUR', 'en-GB', TRUE)
      ON CONFLICT (code) DO NOTHING;

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_e164 TEXT,
        phone_hash TEXT,
        display_name TEXT NOT NULL,
        avatar_attachment_id UUID,
        default_currency_code CHAR(3) NOT NULL DEFAULT 'INR' REFERENCES currencies(code),
        locale TEXT NOT NULL DEFAULT 'en-IN',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'deleted_pending')),
        state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'disabled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX uq_users_phone_hash ON users (phone_hash) WHERE phone_hash IS NOT NULL;

      CREATE TABLE attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id UUID NOT NULL REFERENCES users(id),
        storage_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
        sha256 TEXT NOT NULL,
        purpose TEXT NOT NULL CHECK (purpose IN ('receipt', 'payment_proof', 'avatar', 'export')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_attachments_owner_created ON attachments (owner_user_id, created_at DESC);
      CREATE INDEX idx_attachments_sha256 ON attachments (sha256);
      ALTER TABLE users
        ADD CONSTRAINT fk_users_avatar_attachment_id
        FOREIGN KEY (avatar_attachment_id) REFERENCES attachments(id);

      CREATE TABLE auth_identities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        provider TEXT NOT NULL CHECK (provider IN ('phone', 'phone_otp', 'google', 'apple', 'email')),
        provider_subject TEXT,
        identifier TEXT,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_auth_identities_provider_subject UNIQUE (provider, provider_subject)
      );
      CREATE UNIQUE INDEX uq_auth_identities_provider_identifier ON auth_identities (provider, identifier) WHERE identifier IS NOT NULL;
      CREATE INDEX idx_auth_identities_user_id ON auth_identities (user_id);

      CREATE TABLE otp_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_hash TEXT,
        otp_hash TEXT,
        phone_e164 TEXT,
        provider_challenge_id TEXT,
        purpose TEXT NOT NULL CHECK (purpose IN ('login', 'claim_invite')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_otp_challenges_phone_hash_expires_at ON otp_challenges (phone_hash, expires_at);

      CREATE TABLE refresh_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        device_id UUID,
        refresh_token_hash TEXT,
        token_hash TEXT,
        device_label TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX uq_refresh_sessions_token_hash ON refresh_sessions (token_hash) WHERE token_hash IS NOT NULL;
      CREATE INDEX idx_refresh_sessions_user_id ON refresh_sessions (user_id);
      CREATE INDEX idx_refresh_sessions_device_id ON refresh_sessions (device_id);

      CREATE TABLE device_installations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
        app_version TEXT NOT NULL,
        push_token TEXT,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_device_installations_user_id ON device_installations (user_id);
      CREATE INDEX idx_device_installations_push_token ON device_installations (push_token) WHERE push_token IS NOT NULL;

      CREATE TABLE consent_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        purpose TEXT NOT NULL CHECK (purpose IN ('contacts_discovery', 'receipt_upload', 'upi_proof_storage', 'notification_delivery', 'financial_import')),
        status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
        source TEXT NOT NULL CHECK (source IN ('onboarding', 'settings', 'capture_flow')),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        granted_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      );
      CREATE INDEX idx_consent_records_user_purpose ON consent_records (user_id, purpose);

      CREATE TABLE contact_aliases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id UUID NOT NULL REFERENCES users(id),
        phone_hash TEXT NOT NULL,
        display_name TEXT,
        source TEXT NOT NULL CHECK (source IN ('manual', 'contacts_import')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_contact_aliases_owner_phone UNIQUE (owner_user_id, phone_hash)
      );

      CREATE TABLE groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('flat', 'trip', 'couple', 'event', 'business', 'custom')),
        base_currency_code CHAR(3) NOT NULL DEFAULT 'INR' REFERENCES currencies(code),
        state TEXT NOT NULL CHECK (state IN ('active', 'archived', 'deleted_empty')),
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        archived_at TIMESTAMPTZ
      );
      CREATE INDEX idx_groups_created_by_user_id ON groups (created_by_user_id);
      CREATE INDEX idx_groups_state_created_at ON groups (state, created_at DESC);

      CREATE TABLE participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID REFERENCES groups(id),
        registered_user_id UUID REFERENCES users(id),
        participant_type TEXT NOT NULL DEFAULT 'guest' CHECK (participant_type IN ('individual', 'guest', 'couple', 'household', 'subgroup')),
        display_name TEXT NOT NULL,
        phone_e164 TEXT,
        phone_hash TEXT,
        guest_claim_token_hash TEXT,
        kind TEXT NOT NULL DEFAULT 'guest' CHECK (kind IN ('user', 'guest', 'subgroup')),
        linked_user_id UUID REFERENCES users(id),
        invited_by_user_id UUID REFERENCES users(id),
        state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'claimed', 'inactive')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_participants_group_id ON participants (group_id);
      CREATE INDEX idx_participants_registered_user_id ON participants (registered_user_id);
      CREATE INDEX idx_participants_phone_hash ON participants (phone_hash) WHERE phone_hash IS NOT NULL;

      CREATE TABLE group_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        user_id UUID REFERENCES users(id),
        participant_id UUID NOT NULL REFERENCES participants(id),
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive_locked', 'removed_zero_balance', 'transferred_obligation', 'locked_for_exit', 'inactive')),
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        left_at TIMESTAMPTZ,
        locked_at TIMESTAMPTZ,
        exit_lock_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_group_memberships_group_participant UNIQUE (group_id, participant_id)
      );
      CREATE INDEX idx_group_memberships_user_status ON group_memberships (user_id, status);
      CREATE INDEX idx_group_memberships_participant_status ON group_memberships (participant_id, status);

      CREATE TABLE participant_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        parent_participant_id UUID NOT NULL REFERENCES participants(id),
        child_participant_id UUID NOT NULL REFERENCES participants(id),
        relationship_type TEXT NOT NULL CHECK (relationship_type IN ('couple_member', 'household_member', 'subgroup_member')),
        default_weight_numerator BIGINT NOT NULL DEFAULT 1 CHECK (default_weight_numerator > 0),
        default_weight_denominator BIGINT NOT NULL DEFAULT 1 CHECK (default_weight_denominator > 0),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT uq_participant_relationships_group_parent_child_type UNIQUE (group_id, parent_participant_id, child_participant_id, relationship_type)
      );
      CREATE INDEX idx_participant_relationships_group_parent ON participant_relationships (group_id, parent_participant_id);

      CREATE TABLE group_role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        permission TEXT NOT NULL CHECK (permission IN ('expense_create', 'expense_edit_own', 'expense_edit_any', 'expense_void', 'settlement_confirm', 'member_invite', 'member_role_change', 'export', 'archive', 'group.read', 'group.invite.create', 'participant.create', 'membership.role.update', 'group.archive', 'membership.exit.lock', 'obligation_transfer.create', 'financial.expense.create', 'financial.expense.edit.any', 'financial.expense.void', 'financial.settlement.confirm', 'financial.export')),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        allowed BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT uq_group_role_permissions_group_role_permission UNIQUE (group_id, role, permission)
      );

      CREATE TABLE group_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        invite_token_hash TEXT UNIQUE,
        token TEXT UNIQUE,
        intended_phone_hash TEXT,
        role_on_accept TEXT NOT NULL DEFAULT 'member' CHECK (role_on_accept IN ('owner', 'admin', 'member', 'viewer')),
        max_uses INTEGER,
        uses INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_group_invites_group_id ON group_invites (group_id);

      CREATE TABLE event_store (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stream_id TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id UUID NOT NULL,
        group_id UUID REFERENCES groups(id),
        version INTEGER NOT NULL CHECK (version > 0),
        global_position BIGSERIAL UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        event_schema_version INTEGER NOT NULL CHECK (event_schema_version > 0),
        actor_user_id UUID REFERENCES users(id),
        idempotency_key TEXT,
        correlation_id UUID NOT NULL,
        causation_id UUID,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        previous_hash TEXT,
        event_hash TEXT NOT NULL,
        CONSTRAINT uq_event_store_stream_version UNIQUE (stream_id, version)
      );
      CREATE INDEX idx_event_store_idempotency_key_present ON event_store (idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE INDEX idx_event_store_group_position ON event_store (group_id, global_position);
      CREATE INDEX idx_event_store_event_type_occurred_at ON event_store (event_type, occurred_at DESC);
      CREATE INDEX idx_event_store_payload_gin ON event_store USING gin (payload jsonb_path_ops);

      CREATE TABLE ledger_postings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES event_store(id),
        group_id UUID NOT NULL REFERENCES groups(id),
        participant_id UUID NOT NULL REFERENCES participants(id),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        signed_amount_minor BIGINT NOT NULL,
        posting_type TEXT NOT NULL CHECK (posting_type IN ('expense_payment', 'expense_share', 'settlement_paid', 'settlement_received', 'fx_close', 'fx_open', 'obligation_transfer_debit', 'obligation_transfer_credit', 'reversal')),
        source_type TEXT NOT NULL,
        source_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_ledger_postings_group_participant_currency ON ledger_postings (group_id, participant_id, currency_code);
      CREATE INDEX idx_ledger_postings_source ON ledger_postings (source_type, source_id);
      CREATE INDEX idx_ledger_postings_event_id ON ledger_postings (event_id);

      CREATE OR REPLACE FUNCTION assert_event_postings_balanced(p_event_id UUID)
      RETURNS void AS $$
      DECLARE
        imbalance_count INTEGER;
      BEGIN
        SELECT count(*)
          INTO imbalance_count
          FROM (
            SELECT currency_code
              FROM ledger_postings
             WHERE event_id = p_event_id
             GROUP BY currency_code
            HAVING COALESCE(sum(signed_amount_minor), 0) <> 0
          ) imbalances;

        IF imbalance_count > 0 THEN
          RAISE EXCEPTION 'Ledger postings are not balanced for event %', p_event_id;
        END IF;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION assert_ledger_postings_balanced_trigger()
      RETURNS trigger AS $$
      DECLARE
        target_event_id UUID;
      BEGIN
        target_event_id := COALESCE(NEW.event_id, OLD.event_id);
        PERFORM assert_event_postings_balanced(target_event_id);
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE CONSTRAINT TRIGGER ledger_postings_balance_check
        AFTER INSERT OR UPDATE OR DELETE ON ledger_postings
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION assert_ledger_postings_balanced_trigger();

      CREATE TABLE idempotency_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope TEXT NOT NULL,
        actor_key TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed')),
        response_snapshot JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ,
        CONSTRAINT uq_idempotency_records_scope_actor_key UNIQUE (scope, actor_key, idempotency_key)
      );

      CREATE TABLE projection_checkpoints (
        projector_name TEXT PRIMARY KEY,
        last_global_position BIGINT NOT NULL DEFAULT 0,
        projector_version INTEGER NOT NULL CHECK (projector_version > 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE group_balance_projection (
        group_id UUID NOT NULL REFERENCES groups(id),
        participant_id UUID NOT NULL REFERENCES participants(id),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        balance_minor BIGINT NOT NULL DEFAULT 0,
        last_global_position BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (group_id, participant_id, currency_code)
      );
      CREATE INDEX idx_group_balance_projection_participant_currency ON group_balance_projection (participant_id, currency_code);

      CREATE TABLE activity_feed_projection (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        event_id UUID NOT NULL REFERENCES event_store(id),
        actor_user_id UUID REFERENCES users(id),
        activity_type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        amount_minor BIGINT,
        currency_code CHAR(3) REFERENCES currencies(code),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX idx_activity_feed_projection_group_occurred ON activity_feed_projection (group_id, occurred_at DESC);

      CREATE TABLE search_projection (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        amount_minor BIGINT,
        currency_code CHAR(3) REFERENCES currencies(code),
        occurred_at TIMESTAMPTZ NOT NULL,
        search_vector tsvector
      );
      CREATE INDEX idx_search_projection_group_occurred ON search_projection (group_id, occurred_at DESC);
      CREATE INDEX idx_search_projection_search_vector ON search_projection USING gin (search_vector);

      CREATE OR REPLACE FUNCTION set_search_projection_vector()
      RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('simple', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER search_projection_vector_trigger
        BEFORE INSERT OR UPDATE OF title, body ON search_projection
        FOR EACH ROW
        EXECUTE FUNCTION set_search_projection_vector();

      CREATE TABLE settlement_suggestion_projection (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        payer_participant_id UUID NOT NULL REFERENCES participants(id),
        payee_participant_id UUID NOT NULL REFERENCES participants(id),
        amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        state TEXT NOT NULL DEFAULT 'active',
        explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_global_position BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_settlement_suggestion_projection_group_state ON settlement_suggestion_projection (group_id, state, created_at DESC);

      CREATE TABLE sync_projection_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        global_position BIGINT NOT NULL,
        group_id UUID REFERENCES groups(id),
        user_id UUID REFERENCES users(id),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        change_type TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_sync_projection_changes_group_position ON sync_projection_changes (group_id, global_position);
      CREATE INDEX idx_sync_projection_changes_user_position ON sync_projection_changes (user_id, global_position);

      CREATE TABLE audit_log_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES event_store(id),
        group_id UUID REFERENCES groups(id),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        actor_user_id UUID REFERENCES users(id),
        action TEXT NOT NULL,
        diff JSONB NOT NULL DEFAULT '{}'::jsonb,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_audit_log_entries_entity_created ON audit_log_entries (entity_type, entity_id, created_at DESC);
      CREATE INDEX idx_audit_log_entries_group_created ON audit_log_entries (group_id, created_at DESC);

      CREATE TABLE offline_command_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_mutation_id UUID NOT NULL UNIQUE,
        actor_user_id UUID NOT NULL REFERENCES users(id),
        device_id UUID REFERENCES device_installations(id),
        group_id UUID REFERENCES groups(id),
        aggregate_type TEXT,
        aggregate_id UUID,
        expected_aggregate_version INTEGER,
        command_type TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'accepted', 'rejected', 'conflicted', 'failed')),
        accepted_event_id UUID REFERENCES event_store(id),
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at TIMESTAMPTZ
      );
      CREATE INDEX idx_offline_command_queue_actor_status ON offline_command_queue (actor_user_id, status, created_at);
      CREATE INDEX idx_offline_command_queue_group_status ON offline_command_queue (group_id, status, created_at);

      CREATE TABLE receipt_drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        attachment_id UUID REFERENCES attachments(id),
        source TEXT NOT NULL CHECK (source IN ('gallery', 'camera', 'screenshot', 'share_sheet', 'manual_text')),
        state TEXT NOT NULL CHECK (state IN ('uploaded', 'ocr_pending', 'needs_review', 'reviewed', 'posted', 'discarded')),
        merchant_name TEXT,
        receipt_date DATE,
        currency_code CHAR(3) NOT NULL DEFAULT 'INR' REFERENCES currencies(code),
        subtotal_minor BIGINT,
        tax_minor BIGINT,
        total_minor BIGINT,
        confidence NUMERIC(5,4),
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_receipt_drafts_group_state_created ON receipt_drafts (group_id, state, created_at DESC);

      CREATE TABLE receipt_ocr_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_draft_id UUID NOT NULL REFERENCES receipt_drafts(id),
        provider TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        raw_json JSONB NOT NULL,
        confidence NUMERIC(5,4) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_receipt_ocr_results_draft_created ON receipt_ocr_results (receipt_draft_id, created_at DESC);

      CREATE TABLE receipt_draft_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_draft_id UUID NOT NULL REFERENCES receipt_drafts(id),
        label TEXT NOT NULL,
        amount_minor BIGINT NOT NULL,
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        confidence NUMERIC(5,4) NOT NULL,
        position INTEGER NOT NULL
      );
      CREATE INDEX idx_receipt_draft_items_draft_position ON receipt_draft_items (receipt_draft_id, position);

      CREATE TABLE capture_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        source TEXT NOT NULL CHECK (source IN ('share_sheet', 'paste', 'sms_manual', 'email_forward', 'android_notification')),
        raw_text TEXT,
        attachment_id UUID REFERENCES attachments(id),
        state TEXT NOT NULL,
        parsed_result JSONB,
        consent_record_id UUID REFERENCES consent_records(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_capture_jobs_user_state_created ON capture_jobs (user_id, state, created_at DESC);

      CREATE TABLE expense_projection (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        current_version INTEGER NOT NULL CHECK (current_version > 0),
        state TEXT NOT NULL CHECK (state IN ('active', 'voided')),
        description TEXT NOT NULL,
        category TEXT,
        expense_date DATE NOT NULL,
        total_amount_minor BIGINT NOT NULL CHECK (total_amount_minor >= 0),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        last_event_id UUID NOT NULL REFERENCES event_store(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        voided_at TIMESTAMPTZ
      );
      CREATE INDEX idx_expense_projection_group_expense_date ON expense_projection (group_id, expense_date DESC);
      CREATE INDEX idx_expense_projection_group_state_updated ON expense_projection (group_id, state, updated_at DESC);

      CREATE TABLE expense_payers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expense_projection(id) ON DELETE CASCADE,
        participant_id UUID NOT NULL REFERENCES participants(id),
        amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        source TEXT NOT NULL CHECK (source IN ('cash', 'upi', 'card', 'unknown')),
        CONSTRAINT uq_expense_payers_expense_participant_currency UNIQUE (expense_id, participant_id, currency_code)
      );

      CREATE TABLE expense_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expense_projection(id) ON DELETE CASCADE,
        participant_id UUID NOT NULL REFERENCES participants(id),
        share_type TEXT NOT NULL CHECK (share_type IN ('equal', 'exact', 'percent', 'weight', 'itemized')),
        weight_numerator BIGINT,
        weight_denominator BIGINT,
        amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        rounding_delta_minor BIGINT NOT NULL DEFAULT 0,
        CONSTRAINT uq_expense_shares_expense_participant_currency UNIQUE (expense_id, participant_id, currency_code),
        CONSTRAINT chk_expense_shares_weight_denominator CHECK (weight_denominator IS NULL OR weight_denominator > 0)
      );

      CREATE TABLE expense_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expense_projection(id) ON DELETE CASCADE,
        receipt_draft_id UUID REFERENCES receipt_drafts(id),
        label TEXT NOT NULL,
        quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
        unit_amount_minor BIGINT NOT NULL,
        gross_amount_minor BIGINT NOT NULL,
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        taxable BOOLEAN NOT NULL DEFAULT TRUE,
        confidence NUMERIC(5,4),
        position INTEGER NOT NULL
      );
      CREATE INDEX idx_expense_line_items_expense_position ON expense_line_items (expense_id, position);

      CREATE TABLE expense_line_item_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        line_item_id UUID NOT NULL REFERENCES expense_line_items(id) ON DELETE CASCADE,
        participant_id UUID NOT NULL REFERENCES participants(id),
        weight_numerator BIGINT NOT NULL CHECK (weight_numerator > 0),
        weight_denominator BIGINT NOT NULL CHECK (weight_denominator > 0),
        amount_minor BIGINT NOT NULL,
        rounding_delta_minor BIGINT NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_expense_line_item_assignments_line_item ON expense_line_item_assignments (line_item_id);
      CREATE INDEX idx_expense_line_item_assignments_participant ON expense_line_item_assignments (participant_id);

      CREATE TABLE bill_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expense_projection(id) ON DELETE CASCADE,
        adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('tax', 'gst_cgst', 'gst_sgst', 'service_charge', 'tip', 'discount', 'rounding')),
        label TEXT NOT NULL,
        amount_minor BIGINT NOT NULL,
        allocation_basis TEXT NOT NULL CHECK (allocation_basis IN ('subtotal_proportional', 'equal', 'manual', 'taxable_items_only')),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code)
      );
      CREATE INDEX idx_bill_adjustments_expense_id ON bill_adjustments (expense_id);

      CREATE TABLE rounding_residual_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type TEXT NOT NULL CHECK (source_type IN ('expense', 'line_item', 'bill_adjustment', 'fx')),
        source_id UUID NOT NULL,
        participant_id UUID NOT NULL REFERENCES participants(id),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        residual_minor BIGINT NOT NULL,
        reason TEXT NOT NULL
      );
      CREATE INDEX idx_rounding_residual_allocations_source ON rounding_residual_allocations (source_type, source_id);

      CREATE TABLE expense_version_projection (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expense_projection(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK (version > 0),
        event_id UUID NOT NULL REFERENCES event_store(id),
        actor_user_id UUID NOT NULL REFERENCES users(id),
        change_summary JSONB NOT NULL,
        snapshot JSONB NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_expense_version_projection_expense_version UNIQUE (expense_id, version)
      );

      CREATE TABLE expense_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expense_projection(id) ON DELETE CASCADE,
        event_id UUID NOT NULL REFERENCES event_store(id),
        author_user_id UUID NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_expense_comments_expense_created ON expense_comments (expense_id, created_at DESC);

      CREATE TABLE evidence_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('expense', 'settlement', 'dispute')),
        entity_id UUID NOT NULL,
        attachment_id UUID NOT NULL REFERENCES attachments(id),
        event_id UUID NOT NULL REFERENCES event_store(id),
        uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_evidence_attachments_entity ON evidence_attachments (entity_type, entity_id);

      CREATE TABLE recurring_expense_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        state TEXT NOT NULL CHECK (state IN ('active', 'paused', 'ended')),
        template JSONB NOT NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'custom_rrule')),
        rrule TEXT,
        next_run_at TIMESTAMPTZ NOT NULL,
        reminder_days_before INTEGER NOT NULL DEFAULT 2 CHECK (reminder_days_before >= 0),
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_recurring_expense_schedules_group_state_next ON recurring_expense_schedules (group_id, state, next_run_at);

      CREATE TABLE recurring_occurrences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id UUID NOT NULL REFERENCES recurring_expense_schedules(id) ON DELETE CASCADE,
        expense_id UUID REFERENCES expense_projection(id),
        scheduled_for DATE NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending', 'generated', 'skipped', 'failed')),
        CONSTRAINT uq_recurring_occurrences_schedule_date UNIQUE (schedule_id, scheduled_for)
      );

      CREATE TABLE fx_rate_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        base_currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        quote_currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        rate_numerator BIGINT NOT NULL CHECK (rate_numerator > 0),
        rate_denominator BIGINT NOT NULL CHECK (rate_denominator > 0),
        provider TEXT NOT NULL,
        as_of TIMESTAMPTZ NOT NULL,
        source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT uq_fx_rate_snapshots_pair_provider_as_of UNIQUE (base_currency_code, quote_currency_code, provider, as_of)
      );

      CREATE TABLE settlement_intents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        payer_participant_id UUID NOT NULL REFERENCES participants(id),
        payee_participant_id UUID NOT NULL REFERENCES participants(id),
        amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        state TEXT NOT NULL CHECK (state IN ('suggested', 'intent_created', 'intent_generated', 'payer_opened_upi_app', 'awaiting_payment_evidence', 'proof_submitted', 'auto_matched', 'awaiting_receiver_confirmation', 'confirmed', 'ledger_posted', 'expired', 'cancelled', 'disputed', 'rejected', 'partial_detected', 'duplicate_reference_review', 'reversed', 'refunded')),
        suggestion_id UUID REFERENCES settlement_suggestion_projection(id),
        upi_uri TEXT,
        upi_payee_vpa_encrypted TEXT,
        upi_payee_name TEXT,
        preferred_upi_app TEXT CHECK (preferred_upi_app IS NULL OR preferred_upi_app IN ('gpay', 'phonepe', 'paytm', 'bhim', 'other')),
        client_reference TEXT NOT NULL UNIQUE,
        provider_name TEXT,
        provider_payment_id TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_settlement_intents_group_state_created ON settlement_intents (group_id, state, created_at DESC);
      CREATE UNIQUE INDEX uq_settlement_intents_provider_payment ON settlement_intents (provider_name, provider_payment_id)
        WHERE provider_name IS NOT NULL AND provider_payment_id IS NOT NULL;

      CREATE TABLE settlement_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_intent_id UUID NOT NULL REFERENCES settlement_intents(id) ON DELETE CASCADE,
        event_id UUID REFERENCES event_store(id),
        actor_user_id UUID REFERENCES users(id),
        event_type TEXT NOT NULL CHECK (event_type IN ('intent_created', 'upi_uri_generated', 'upi_app_opened', 'proof_submitted', 'proof_auto_matched', 'receiver_confirmed', 'receiver_rejected', 'disputed', 'ledger_posted', 'expired', 'reversed', 'refunded')),
        from_state TEXT,
        to_state TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_settlement_events_intent_occurred ON settlement_events (settlement_intent_id, occurred_at);

      CREATE TABLE upi_app_open_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_intent_id UUID NOT NULL REFERENCES settlement_intents(id) ON DELETE CASCADE,
        app_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        opened_at TIMESTAMPTZ NOT NULL,
        client_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE INDEX idx_upi_app_open_events_intent_opened ON upi_app_open_events (settlement_intent_id, opened_at);

      CREATE TABLE payment_proofs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_intent_id UUID NOT NULL REFERENCES settlement_intents(id) ON DELETE CASCADE,
        group_id UUID NOT NULL REFERENCES groups(id),
        submitted_by_user_id UUID NOT NULL REFERENCES users(id),
        proof_type TEXT NOT NULL CHECK (proof_type IN ('screenshot', 'utr_text', 'provider_callback', 'manual_note')),
        attachment_id UUID REFERENCES attachments(id),
        upi_reference_hash TEXT,
        claimed_amount_minor BIGINT NOT NULL CHECK (claimed_amount_minor >= 0),
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        paid_at TIMESTAMPTZ,
        status TEXT NOT NULL CHECK (status IN ('submitted', 'auto_matched', 'needs_receiver_confirmation', 'accepted', 'rejected', 'disputed')),
        ocr_extracted JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_payment_proofs_intent_created ON payment_proofs (settlement_intent_id, created_at DESC);
      CREATE INDEX idx_payment_proofs_group_reference_hash ON payment_proofs (group_id, upi_reference_hash) WHERE upi_reference_hash IS NOT NULL;

      CREATE TABLE upi_payment_references (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        settlement_intent_id UUID NOT NULL REFERENCES settlement_intents(id) ON DELETE CASCADE,
        upi_reference_hash TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('proof_utr', 'provider_callback', 'manual_entry')),
        first_seen_proof_id UUID REFERENCES payment_proofs(id),
        provider_payment_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_upi_payment_references_group_reference_hash UNIQUE (group_id, upi_reference_hash)
      );
      CREATE INDEX idx_upi_payment_references_intent ON upi_payment_references (settlement_intent_id);

      CREATE TABLE settlement_confirmations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_intent_id UUID NOT NULL REFERENCES settlement_intents(id) ON DELETE CASCADE,
        confirmed_by_user_id UUID NOT NULL REFERENCES users(id),
        decision TEXT NOT NULL CHECK (decision IN ('accept', 'reject', 'dispute', 'accept_partial')),
        amount_minor BIGINT,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_settlement_confirmations_intent_created ON settlement_confirmations (settlement_intent_id, created_at DESC);

      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        group_id UUID REFERENCES groups(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        entity_type TEXT,
        entity_id UUID,
        tone TEXT NOT NULL CHECK (tone IN ('neutral', 'urgent', 'system', 'action_required')),
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_notifications_user_read_created ON notifications (user_id, read_at, created_at DESC);
      CREATE INDEX idx_notifications_group_created ON notifications (group_id, created_at DESC);

      CREATE TABLE notification_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
        channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('push', 'email', 'in_app')),
        provider TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'suppressed', 'skipped')),
        provider_message_id TEXT,
        error TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        last_error TEXT,
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ
      );
      CREATE INDEX idx_notification_deliveries_notification_id ON notification_deliveries (notification_id);
      CREATE INDEX idx_notification_deliveries_status ON notification_deliveries (status);

      CREATE TABLE reminder_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        type TEXT NOT NULL CHECK (type IN ('settlement_day', 'recurring_expense', 'stale_proof')),
        schedule JSONB NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_by_user_id UUID NOT NULL REFERENCES users(id)
      );
      CREATE INDEX idx_reminder_schedules_group_type ON reminder_schedules (group_id, type);

      CREATE TABLE import_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        source TEXT NOT NULL CHECK (source IN ('splitwise_csv', 'splitwise_json')),
        state TEXT NOT NULL CHECK (state IN ('uploaded', 'parsed', 'reviewed', 'posting', 'completed', 'failed')),
        attachment_id UUID NOT NULL REFERENCES attachments(id),
        summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_import_jobs_user_state_created ON import_jobs (user_id, state, created_at DESC);

      CREATE TABLE import_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
        external_id TEXT,
        item_type TEXT NOT NULL,
        parsed_payload JSONB NOT NULL,
        mapped_entity_type TEXT,
        mapped_entity_id UUID,
        status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'skipped', 'duplicate', 'posted', 'failed'))
      );
      CREATE INDEX idx_import_items_job_status ON import_items (import_job_id, status);
      CREATE UNIQUE INDEX uq_import_items_job_external_present ON import_items (import_job_id, external_id) WHERE external_id IS NOT NULL;

      CREATE TABLE external_entity_maps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        CONSTRAINT uq_external_entity_maps_source_external_entity UNIQUE (source, external_id, entity_type)
      );

      CREATE TABLE export_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        group_id UUID REFERENCES groups(id),
        export_type TEXT NOT NULL CHECK (export_type IN ('expenses_csv', 'balances_csv', 'full_group_csv', 'group_pdf', 'tally_csv', 'settlement_certificate', 'data_portability_json')),
        state TEXT NOT NULL,
        parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
        file_attachment_id UUID REFERENCES attachments(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      );
      CREATE INDEX idx_export_jobs_user_state_created ON export_jobs (user_id, state, created_at DESC);

      CREATE TABLE statement_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
        snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_statement_snapshots_group_period ON statement_snapshots (group_id, period_start, period_end);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS ledger_postings_balance_check ON ledger_postings;
      DROP FUNCTION IF EXISTS assert_ledger_postings_balanced_trigger();
      DROP FUNCTION IF EXISTS assert_event_postings_balanced(UUID);
      DROP TRIGGER IF EXISTS search_projection_vector_trigger ON search_projection;
      DROP FUNCTION IF EXISTS set_search_projection_vector();

      DROP TABLE IF EXISTS statement_snapshots CASCADE;
      DROP TABLE IF EXISTS export_jobs CASCADE;
      DROP TABLE IF EXISTS external_entity_maps CASCADE;
      DROP TABLE IF EXISTS import_items CASCADE;
      DROP TABLE IF EXISTS import_jobs CASCADE;
      DROP TABLE IF EXISTS reminder_schedules CASCADE;
      DROP TABLE IF EXISTS notification_deliveries CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS settlement_confirmations CASCADE;
      DROP TABLE IF EXISTS upi_payment_references CASCADE;
      DROP TABLE IF EXISTS payment_proofs CASCADE;
      DROP TABLE IF EXISTS upi_app_open_events CASCADE;
      DROP TABLE IF EXISTS settlement_events CASCADE;
      DROP TABLE IF EXISTS settlement_intents CASCADE;
      DROP TABLE IF EXISTS fx_rate_snapshots CASCADE;
      DROP TABLE IF EXISTS recurring_occurrences CASCADE;
      DROP TABLE IF EXISTS recurring_expense_schedules CASCADE;
      DROP TABLE IF EXISTS evidence_attachments CASCADE;
      DROP TABLE IF EXISTS expense_comments CASCADE;
      DROP TABLE IF EXISTS expense_version_projection CASCADE;
      DROP TABLE IF EXISTS rounding_residual_allocations CASCADE;
      DROP TABLE IF EXISTS bill_adjustments CASCADE;
      DROP TABLE IF EXISTS expense_line_item_assignments CASCADE;
      DROP TABLE IF EXISTS expense_line_items CASCADE;
      DROP TABLE IF EXISTS expense_shares CASCADE;
      DROP TABLE IF EXISTS expense_payers CASCADE;
      DROP TABLE IF EXISTS expense_projection CASCADE;
      DROP TABLE IF EXISTS capture_jobs CASCADE;
      DROP TABLE IF EXISTS receipt_draft_items CASCADE;
      DROP TABLE IF EXISTS receipt_ocr_results CASCADE;
      DROP TABLE IF EXISTS receipt_drafts CASCADE;
      DROP TABLE IF EXISTS offline_command_queue CASCADE;
      DROP TABLE IF EXISTS audit_log_entries CASCADE;
      DROP TABLE IF EXISTS sync_projection_changes CASCADE;
      DROP TABLE IF EXISTS settlement_suggestion_projection CASCADE;
      DROP TABLE IF EXISTS search_projection CASCADE;
      DROP TABLE IF EXISTS activity_feed_projection CASCADE;
      DROP TABLE IF EXISTS group_balance_projection CASCADE;
      DROP TABLE IF EXISTS projection_checkpoints CASCADE;
      DROP TABLE IF EXISTS idempotency_records CASCADE;
      DROP TABLE IF EXISTS ledger_postings CASCADE;
      DROP TABLE IF EXISTS event_store CASCADE;
      DROP TABLE IF EXISTS group_invites CASCADE;
      DROP TABLE IF EXISTS group_role_permissions CASCADE;
      DROP TABLE IF EXISTS participant_relationships CASCADE;
      DROP TABLE IF EXISTS group_memberships CASCADE;
      DROP TABLE IF EXISTS participants CASCADE;
      DROP TABLE IF EXISTS groups CASCADE;
      DROP TABLE IF EXISTS contact_aliases CASCADE;
      DROP TABLE IF EXISTS consent_records CASCADE;
      DROP TABLE IF EXISTS device_installations CASCADE;
      DROP TABLE IF EXISTS refresh_sessions CASCADE;
      DROP TABLE IF EXISTS otp_challenges CASCADE;
      DROP TABLE IF EXISTS auth_identities CASCADE;
      DROP TABLE IF EXISTS attachments CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS currencies CASCADE;
    `);
  }
}
