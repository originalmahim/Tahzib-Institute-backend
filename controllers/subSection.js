const Section = require('../models/section');
const SubSection = require('../models/subSection');
const { uploadImageToCloudinary } = require('../utils/imageUploader');



// ================ create SubSection ================
exports.createSubSection = async (req, res) => {
    try {
        // extract data
        const { title, description, sectionId, videoUrl } = req.body; // Include videoUrl in the body

        // extract video file
        const videoFile = req.files ? req.files.video : null; // Check if video file is present

        // validation
        if (!title || !description || (!videoFile && !videoUrl) || !sectionId) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        let videoDetails;

        // Check if the video is uploaded or if a YouTube URL is provided
        if (videoFile) {
            // upload video to cloudinary
            videoDetails = await uploadImageToCloudinary(videoFile, process.env.FOLDER_NAME);
        } else if (videoUrl) {
            // Validate YouTube URL format if necessary
            const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
            if (!youtubeUrlRegex.test(videoUrl)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid YouTube URL'
                });
            }
            // If it's a YouTube URL, use it directly
            videoDetails = { secure_url: videoUrl, duration: null }; // Duration can be null or handled later
        }

        // create entry in DB
        const SubSectionDetails = await SubSection.create(
            {
                title,
                timeDuration: videoDetails.duration,
                description,
                videoUrl: videoDetails.secure_url
            }
        );

        // link subsection id to section
        const updatedSection = await Section.findByIdAndUpdate(
            { _id: sectionId },
            { $push: { subSection: SubSectionDetails._id } },
            { new: true }
        ).populate("subSection");

        // return response
        res.status(200).json({
            success: true,
            data: updatedSection,
            message: 'SubSection created successfully'
        });
    }
    catch (error) {
        console.log('Error while creating SubSection');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while creating SubSection'
        });
    }
}




// ================ Update SubSection ================
exports.updateSubSection = async (req, res) => {
    try {
        const { sectionId, subSectionId, title, description, videoUrl } = req.body;

        // Validation
        if (!subSectionId) {
            return res.status(400).json({
                success: false,
                message: 'subSection ID is required to update'
            });
        }

        // Find in DB
        const subSection = await SubSection.findById(subSectionId);

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "SubSection not found",
            });
        }

        // Update fields
        if (title) {
            subSection.title = title;
        }

        if (description) {
            subSection.description = description;
        }

        // Handle video update
        if (req.files && req.files.videoFile) {
            const video = req.files.videoFile;
            const uploadDetails = await uploadImageToCloudinary(video, process.env.FOLDER_NAME);
            subSection.videoUrl = uploadDetails.secure_url;
            subSection.timeDuration = uploadDetails.duration;
        } else if (videoUrl) {
            const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
            if (!youtubeUrlRegex.test(videoUrl)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid YouTube URL'
                });
            }
            subSection.videoUrl = videoUrl; // Save the YouTube URL directly
            subSection.timeDuration = null; // Set duration to null or handle accordingly
        }

        // Save data to DB
        await subSection.save();

        const updatedSection = await Section.findById(sectionId).populate("subSection");

        return res.json({
            success: true,
            data: updatedSection,
            message: "Section updated successfully",
        });
    } catch (error) {
        console.error('Error while updating the section');
        console.error(error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: "Error while updating the section",
        });
    }
};




// ================ Delete SubSection ================
exports.deleteSubSection = async (req, res) => {
    try {
        const { subSectionId, sectionId } = req.body
        await Section.findByIdAndUpdate(
            { _id: sectionId },
            {
                $pull: {
                    subSection: subSectionId,
                },
            }
        )

        // delete from DB
        const subSection = await SubSection.findByIdAndDelete({ _id: subSectionId })

        if (!subSection) {
            return res
                .status(404)
                .json({ success: false, message: "SubSection not found" })
        }

        const updatedSection = await Section.findById(sectionId).populate('subSection')

        // In frontned we have to take care - when subsection is deleted we are sending ,
        // only section data not full course details as we do in others 

        // success response
        return res.json({
            success: true,
            data: updatedSection,
            message: "SubSection deleted successfully",
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,

            error: error.message,
            message: "An error occurred while deleting the SubSection",
        })
    }
}