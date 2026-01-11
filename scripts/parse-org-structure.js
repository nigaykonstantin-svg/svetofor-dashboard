/**
 * Парсер организационной структуры MIXIT
 * Преобразует Excel файл в JSON для использования в приложении
 * 
 * Запуск: node scripts/parse-org-structure.js
 */

const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Путь к Excel файлу
const EXCEL_PATH = '/Users/konstantin/Documents/Mixit  MSK/Profit optimizer/оргструктура 544 человека.xls';
const OUTPUT_PATH = path.join(__dirname, '../src/data/org-structure.json');

function parseOrgStructure() {
    console.log('📂 Читаю Excel файл...');

    const workbook = xlsx.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Заголовки находятся в первой строке
    const headers = rawData[0];
    console.log('📋 Найдены колонки:', headers.slice(0, 5));

    // Маппинг колонок (на основе анализа структуры)
    const COL_MAP = {
        fullName: 0,      // ФИО
        department: 1,    // Отдел
        email: 2,         // Email
        phone: 3,         // Телефон
        firstName: 9,     // Имя
        lastName: 10,     // Фамилия
        position: 15,     // Должность
        competencies: 22, // Компетенции
        canHelp: 26       // В чём могу помочь
    };

    const employees = [];
    const departments = new Map();

    // Парсим данные (начиная со 2-й строки, пропуская заголовок)
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];

        // Пропускаем пустые строки
        if (!row[COL_MAP.fullName] || !row[COL_MAP.department]) continue;

        const fullName = String(row[COL_MAP.fullName] || '').trim();
        const departmentName = String(row[COL_MAP.department] || '').trim();
        const email = String(row[COL_MAP.email] || '').trim();
        const phone = String(row[COL_MAP.phone] || '').trim();
        const position = String(row[COL_MAP.position] || '').trim();
        const firstName = String(row[COL_MAP.firstName] || '').trim();
        const lastName = String(row[COL_MAP.lastName] || '').trim();
        const competencies = String(row[COL_MAP.competencies] || '').trim();
        const canHelp = String(row[COL_MAP.canHelp] || '').trim();

        // Пропускаем служебные аккаунты
        if (fullName.toLowerCase() === 'support') continue;

        const employee = {
            id: `emp_${i}`,
            fullName,
            firstName,
            lastName,
            department: departmentName,
            email,
            phone,
            position,
            competencies,
            canHelp
        };

        employees.push(employee);

        // Группируем по департаментам
        if (!departments.has(departmentName)) {
            departments.set(departmentName, {
                id: `dept_${departments.size + 1}`,
                name: departmentName,
                employees: []
            });
        }
        departments.get(departmentName).employees.push(employee.id);
    }

    // Формируем финальную структуру
    const orgStructure = {
        meta: {
            generatedAt: new Date().toISOString(),
            totalEmployees: employees.length,
            totalDepartments: departments.size
        },
        departments: Array.from(departments.values()).map(dept => ({
            ...dept,
            employeeCount: dept.employees.length
        })),
        employees: employees
    };

    // Сохраняем JSON
    console.log(`\n✅ Найдено ${employees.length} сотрудников в ${departments.size} отделах`);

    // Создаём директорию если не существует
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(orgStructure, null, 2), 'utf8');
    console.log(`📁 Сохранено в: ${OUTPUT_PATH}`);

    // Выводим статистику по отделам
    console.log('\n📊 Статистика по отделам:');
    Array.from(departments.values())
        .sort((a, b) => b.employees.length - a.employees.length)
        .slice(0, 10)
        .forEach(dept => {
            console.log(`   ${dept.name}: ${dept.employees.length} чел.`);
        });
}

parseOrgStructure();
