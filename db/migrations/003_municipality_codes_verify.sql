SELECT 'municipality_code_count' AS check_name, COUNT(*) AS count
FROM municipality_codes;

SELECT 'municipality_code_min' AS check_name, MIN(code) AS value
FROM municipality_codes;

SELECT 'municipality_code_max' AS check_name, MAX(code) AS value
FROM municipality_codes;

SELECT 'invalid_municipality_codes' AS check_name, COUNT(*) AS count
FROM municipality_codes
WHERE code !~ '^[0-9]{6}$';

SELECT 'orphan_municipality_prefectures' AS check_name, COUNT(*) AS count
FROM municipality_codes AS municipalities
LEFT JOIN prefectures AS prefectures ON prefectures.code = municipalities.prefecture_code
WHERE prefectures.code IS NULL;
