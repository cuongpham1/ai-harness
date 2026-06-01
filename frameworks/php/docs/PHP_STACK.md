# PHP Stack

## Commands

```bash
composer install
./vendor/bin/phpunit
php artisan test          # Laravel
php artisan serve         # Laravel dev server
```

## Structure (typical)

```
app/
routes/
tests/
public/index.php
composer.json
```

## Validation before done

Run PHPUnit; run static analysis if project configures PHPStan/Psalm.
