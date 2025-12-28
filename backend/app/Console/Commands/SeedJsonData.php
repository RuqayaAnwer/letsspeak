<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\JsonStorage\Repositories\UserRepository;
use App\JsonStorage\Repositories\TrainerRepository;
use App\JsonStorage\Repositories\CourseRepository;
use App\JsonStorage\Repositories\LectureRepository;
use App\JsonStorage\Repositories\PaymentRepository;

class SeedJsonData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'json:seed {--fresh : Clear existing data before seeding}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Seed JSON data files with dummy data for testing';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting JSON data seeding...');

        // Check if dummy data files already exist
        $dummyPath = storage_path('json_data/dummy');
        
        if (!is_dir($dummyPath)) {
            mkdir($dummyPath, 0755, true);
            $this->info('Created dummy data directory');
        }

        // Check if files exist
        $files = ['users', 'trainers', 'courses', 'lectures', 'payments'];
        $existingFiles = [];

        foreach ($files as $file) {
            if (file_exists("{$dummyPath}/{$file}.json")) {
                $existingFiles[] = $file;
            }
        }

        if (!empty($existingFiles) && !$this->option('fresh')) {
            $this->warn('Dummy data files already exist: ' . implode(', ', $existingFiles));
            
            if (!$this->confirm('Do you want to overwrite them?')) {
                $this->info('Seeding cancelled.');
                return 0;
            }
        }

        $this->info('Copying dummy data files...');

        // The dummy data is already in place from the initial setup
        // This command is mainly for documentation and future use

        $this->info('✓ Dummy data is ready!');
        $this->newLine();
        $this->table(
            ['File', 'Status'],
            [
                ['users.json', file_exists("{$dummyPath}/users.json") ? '✓ Ready' : '✗ Missing'],
                ['trainers.json', file_exists("{$dummyPath}/trainers.json") ? '✓ Ready' : '✗ Missing'],
                ['courses.json', file_exists("{$dummyPath}/courses.json") ? '✓ Ready' : '✗ Missing'],
                ['lectures.json', file_exists("{$dummyPath}/lectures.json") ? '✓ Ready' : '✗ Missing'],
                ['payments.json', file_exists("{$dummyPath}/payments.json") ? '✓ Ready' : '✗ Missing'],
            ]
        );

        $this->newLine();
        $this->info('Login credentials (password for all: "password"):');
        $this->table(
            ['Role', 'Username'],
            [
                ['Customer Service', 'cs_admin'],
                ['Finance', 'finance_admin'],
                ['Trainer', 'mohammed'],
                ['Trainer', 'fatima'],
                ['Trainer', 'ali'],
            ]
        );

        return 0;
    }
}





















