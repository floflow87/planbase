-- Add UPDATE policy for app_users
-- Allows users within the same account to update profiles (owner and collaborators only)
-- Note: This is a permissive policy for MVP. In production, you may want to restrict 
-- updates to own profile only by adding user_id to JWT claims.

CREATE POLICY p_update_app_users_same_account ON app_users
FOR UPDATE
USING (
  -- User must be in the same account
  account_id = current_account_id()
  -- And must be owner or collaborator (not client_viewer)
  AND current_user_role() IN ('owner', 'collaborator')
)
WITH CHECK (
  -- Ensure account_id doesn't change (security)
  account_id = current_account_id()
);
