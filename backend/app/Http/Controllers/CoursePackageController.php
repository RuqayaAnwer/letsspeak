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
        $packages = CoursePackage::withCount('courses')->latest()->get();

        return response()->json($packages);
    }

    /**
     * Store a newly created course package.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'lectures_count' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
        ]);

        $package = CoursePackage::create($request->only([
            'name', 'lectures_count', 'description', 'price'
        ]));

        return response()->json($package, 201);
    }

    /**
     * Display the specified course package.
     */
    public function show(CoursePackage $coursePackage)
    {
        return response()->json($coursePackage);
    }

    /**
     * Update the specified course package.
     */
    public function update(Request $request, CoursePackage $coursePackage)
    {
        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'lectures_count' => 'sometimes|required|integer|min:1',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
        ]);

        $coursePackage->update($request->only([
            'name', 'lectures_count', 'description', 'price'
        ]));

        return response()->json($coursePackage);
    }

    /**
     * Remove the specified course package.
     */
    public function destroy(CoursePackage $coursePackage)
    {
        $coursePackage->delete();

        return response()->json(null, 204);
    }
}


















