GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.owner_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_page(uuid, text) TO authenticated;