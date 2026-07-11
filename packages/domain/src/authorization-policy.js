"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationPolicy = void 0;
const defaults = {
    owner: [
        'expense_create',
        'expense_edit_own',
        'expense_edit_any',
        'expense_void',
        'settlement_confirm',
        'member_invite',
        'member_role_change',
        'export',
        'archive'
    ],
    admin: [
        'expense_create',
        'expense_edit_own',
        'expense_edit_any',
        'expense_void',
        'settlement_confirm',
        'member_invite',
        'export'
    ],
    member: ['expense_create', 'expense_edit_own', 'settlement_confirm'],
    viewer: []
};
class AuthorizationPolicy {
    can(role, permission) {
        return defaults[role].includes(permission);
    }
}
exports.AuthorizationPolicy = AuthorizationPolicy;
//# sourceMappingURL=authorization-policy.js.map