import { User, Category, Team, CATEGORY_LABELS } from './auth-types';

// Mock users for development (replace with Supabase later)
export const MOCK_USERS: User[] = [
    // Super Admin
    {
        id: 'sa-1',
        email: 'admin@mixit.ru',
        name: 'Администратор',
        role: 'super_admin',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },

    // Category Managers
    {
        id: 'cm-face',
        email: 'face.manager@mixit.ru',
        name: 'Иванова Мария',
        role: 'category_manager',
        categoryId: 'face',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'cm-body',
        email: 'body.manager@mixit.ru',
        name: 'Петров Алексей',
        role: 'category_manager',
        categoryId: 'body',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'cm-makeup',
        email: 'makeup.manager@mixit.ru',
        name: 'Сидорова Елена',
        role: 'category_manager',
        categoryId: 'makeup',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'cm-hair',
        email: 'hair.manager@mixit.ru',
        name: 'Козлов Дмитрий',
        role: 'category_manager',
        categoryId: 'hair',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },

    // Managers for Face category
    {
        id: 'm-face-1',
        email: 'face1@mixit.ru',
        name: 'Смирнова Анна',
        role: 'manager',
        categoryId: 'face',
        managerId: 'cm-face',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-face-2',
        email: 'face2@mixit.ru',
        name: 'Кузнецов Иван',
        role: 'manager',
        categoryId: 'face',
        managerId: 'cm-face',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-face-3',
        email: 'face3@mixit.ru',
        name: 'Попова Ольга',
        role: 'manager',
        categoryId: 'face',
        managerId: 'cm-face',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-face-4',
        email: 'face4@mixit.ru',
        name: 'Васильев Петр',
        role: 'manager',
        categoryId: 'face',
        managerId: 'cm-face',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-face-5',
        email: 'face5@mixit.ru',
        name: 'Новикова Дарья',
        role: 'manager',
        categoryId: 'face',
        managerId: 'cm-face',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },

    // Managers for Body category
    {
        id: 'm-body-1',
        email: 'body1@mixit.ru',
        name: 'Федоров Михаил',
        role: 'manager',
        categoryId: 'body',
        managerId: 'cm-body',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-body-2',
        email: 'body2@mixit.ru',
        name: 'Морозова Екатерина',
        role: 'manager',
        categoryId: 'body',
        managerId: 'cm-body',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-body-3',
        email: 'body3@mixit.ru',
        name: 'Волков Сергей',
        role: 'manager',
        categoryId: 'body',
        managerId: 'cm-body',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-body-4',
        email: 'body4@mixit.ru',
        name: 'Алексеева Наталья',
        role: 'manager',
        categoryId: 'body',
        managerId: 'cm-body',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-body-5',
        email: 'body5@mixit.ru',
        name: 'Лебедев Андрей',
        role: 'manager',
        categoryId: 'body',
        managerId: 'cm-body',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },

    // Managers for Makeup category
    {
        id: 'm-makeup-1',
        email: 'makeup1@mixit.ru',
        name: 'Соколова Виктория',
        role: 'manager',
        categoryId: 'makeup',
        managerId: 'cm-makeup',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-makeup-2',
        email: 'makeup2@mixit.ru',
        name: 'Павлов Денис',
        role: 'manager',
        categoryId: 'makeup',
        managerId: 'cm-makeup',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-makeup-3',
        email: 'makeup3@mixit.ru',
        name: 'Семенова Юлия',
        role: 'manager',
        categoryId: 'makeup',
        managerId: 'cm-makeup',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-makeup-4',
        email: 'makeup4@mixit.ru',
        name: 'Голубев Артем',
        role: 'manager',
        categoryId: 'makeup',
        managerId: 'cm-makeup',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-makeup-5',
        email: 'makeup5@mixit.ru',
        name: 'Виноградова Алина',
        role: 'manager',
        categoryId: 'makeup',
        managerId: 'cm-makeup',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },

    // Managers for Hair category
    {
        id: 'm-hair-1',
        email: 'hair1@mixit.ru',
        name: 'Богданов Роман',
        role: 'manager',
        categoryId: 'hair',
        managerId: 'cm-hair',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-hair-2',
        email: 'hair2@mixit.ru',
        name: 'Воробьева Ксения',
        role: 'manager',
        categoryId: 'hair',
        managerId: 'cm-hair',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-hair-3',
        email: 'hair3@mixit.ru',
        name: 'Николаев Максим',
        role: 'manager',
        categoryId: 'hair',
        managerId: 'cm-hair',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-hair-4',
        email: 'hair4@mixit.ru',
        name: 'Орлова Татьяна',
        role: 'manager',
        categoryId: 'hair',
        managerId: 'cm-hair',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
    {
        id: 'm-hair-5',
        email: 'hair5@mixit.ru',
        name: 'Андреев Владимир',
        role: 'manager',
        categoryId: 'hair',
        managerId: 'cm-hair',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString(),
    },
];

// Get all teams with their members
export function getTeams(): Team[] {
    const categories: Category[] = ['face', 'body', 'makeup', 'hair'];

    return categories.map(cat => {
        const categoryManager = MOCK_USERS.find(
            u => u.role === 'category_manager' && u.categoryId === cat
        );
        const managers = MOCK_USERS.filter(
            u => u.role === 'manager' && u.categoryId === cat
        );

        return {
            id: cat,
            name: CATEGORY_LABELS[cat],
            categoryManager,
            managers,
        };
    });
}

// Get user by email
export function getUserByEmail(email: string): User | undefined {
    return MOCK_USERS.find(u => u.email === email);
}

// Get user by ID
export function getUserById(id: string): User | undefined {
    return MOCK_USERS.find(u => u.id === id);
}

// Get managers available for assignment by current user
export function getAvailableManagers(currentUser: User): User[] {
    if (currentUser.role === 'super_admin') {
        // Super admin can assign to any manager
        return MOCK_USERS.filter(u => u.role === 'manager');
    }

    if (currentUser.role === 'category_manager') {
        // Category manager can only assign to their managers
        return MOCK_USERS.filter(
            u => u.role === 'manager' && u.managerId === currentUser.id
        );
    }

    return [];
}

// Get category managers
export function getCategoryManagers(): User[] {
    return MOCK_USERS.filter(u => u.role === 'category_manager');
}

// Get all managers
export function getAllManagers(): User[] {
    return MOCK_USERS.filter(u => u.role === 'manager');
}

// Get managers by category
export function getManagersByCategory(category: Category): User[] {
    return MOCK_USERS.filter(
        u => u.role === 'manager' && u.categoryId === category
    );
}
