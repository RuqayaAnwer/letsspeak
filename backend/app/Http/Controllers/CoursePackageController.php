<?php

namespace App\Http\Controllers;

use App\Models\CoursePackage;
use Illuminate\Http\Request;

class CoursePackageController extends Controller
{
    /**
     * Display a listing of course packages.
     */
    public function index()
    {
        $user = auth()->user();
        if (!$user || (!$user->isAdmin() && !$user->isCustomerService() && !$user->isAccounting() && !$user->isFinance())) {
            abort(403, 'Unauthorized action.');
        }

        $packages = CoursePackage::withCount('courses')->latest()->get();

        return response()->json($packages);
    }

    /**
     * Store a newly created course package.
     */
    public function store(Request $request)
    {
        if (!auth()->user() || !auth()->user()->isAdmin()) {
            abort(403, 'Only admins can perform this action.');
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'lectures_count' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'trainee_max_postponements' => 'nullable|integer|min:0',
            'trainer_max_postponements' => 'nullable|integer|min:0',
        ]);

        $package = CoursePackage::create($request->only([
            'name', 'lectures_count', 'description', 'price', 'trainee_max_postponements', 'trainer_max_postponements'
        ]));

        return response()->json($package, 201);
    }

    /**
     * Display the specified course package.
     */
    public function show(CoursePackage $coursePackage)
    {
        $user = auth()->user();
        if (!$user || (!$user->isAdmin() && !$user->isCustomerService() && !$user->isAccounting() && !$user->isFinance())) {
            abort(403, 'Unauthorized action.');
        }

        return response()->json($coursePackage);
    }

    /**
     * Update the specified course package.
     */
    public function update(Request $request, $id)
    {
        if (!auth()->user() || !auth()->user()->isAdmin()) {
            abort(403, 'Only admins can perform this action.');
        }

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'lectures_count' => 'sometimes|required|integer|min:1',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'trainee_max_postponements' => 'sometimes|nullable|integer|min:0',
            'trainer_max_postponements' => 'sometimes|nullable|integer|min:0',
        ]);

        $coursePackage = CoursePackage::findOrFail($id);
        
        $updateData = $request->only([
            'name', 'lectures_count', 'description', 'price', 'trainee_max_postponements', 'trainer_max_postponements'
        ]);
        
        // Log the update data for debugging
        \Log::info('Updating course package', [
            'id' => $id,
            'data' => $updateData,
            'price' => $request->input('price'),
            'price_type' => gettype($request->input('price'))
        ]);
        
        $coursePackage->update($updateData);
        
        // Refresh the model to get the updated data
        $coursePackage->refresh();

        return response()->json($coursePackage);
    }

    /**
     * Remove the specified course package.
     */
    public function destroy($id)
    {
        if (!auth()->user() || !auth()->user()->isAdmin()) {
            abort(403, 'Only admins can perform this action.');
        }

        $coursePackage = CoursePackage::findOrFail($id);
        $coursePackage->delete();

        return response()->json(null, 204);
    }
}
























