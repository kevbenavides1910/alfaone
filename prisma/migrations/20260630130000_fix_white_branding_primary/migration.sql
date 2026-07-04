-- El primario blanco (#ffffff) hace invisibles pestañas y botones con texto blanco.
UPDATE "app_branding"
SET "primaryHex" = '#dc2626'
WHERE LOWER(TRIM("primaryHex")) IN ('#ffffff', '#fff', '#fefefe', '#fafafa', '#f5f5f5', '#eeeeee');
